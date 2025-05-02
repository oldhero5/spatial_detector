"""
Web server implementation for Spatial Detector.
Provides a web interface for using the detector with iPhone camera input.
"""

import os
import json
import logging
import threading
import time
import sys
import platform
import socket
import qrcode
import base64
from io import BytesIO
from typing import Dict, Any, Optional, List

import cv2
import numpy as np
from flask import Flask, render_template, Response, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from spatial_detector.detection import yolo_detector
from spatial_detector.depth import midas_depth
from spatial_detector.projection import camera_model
from spatial_detector.visualization import visualizer


class WebServer:
    """Web server for Spatial Detector application"""
    
    def __init__(
        self, 
        host: str = "0.0.0.0", 
        port: int = 5011,
        static_folder: str = None,
        template_folder: str = None
    ):
        # Detect platform for platform-specific features
        self.is_mac = platform.system() == "Darwin"
        self.qr_code_data = None
        # Initialize folders
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.static_folder = static_folder or os.path.join(current_dir, "static")
        self.template_folder = template_folder or os.path.join(current_dir, "templates")
        
        # Create folders if they don't exist
        os.makedirs(self.static_folder, exist_ok=True)
        os.makedirs(self.template_folder, exist_ok=True)
        
        # Flask app setup
        self.app = Flask(
            __name__, 
            static_folder=self.static_folder,
            template_folder=self.template_folder
        )
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        self.host = host
        self.port = port
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger("spatial_detector.web")
        
        # Detector components
        self.detector = None
        self.depth_estimator = None
        self.camera = None
        self.vis = None
        
        # Stream management
        self.frame_buffer = None
        self.processing_thread = None
        self.is_processing = False
        self.client_streams = {}
        self.active_stream_id = None
        
        # Configure routes
        self._configure_routes()
        self._configure_socket_events()
    
    def _configure_routes(self):
        """Configure HTTP routes"""
        
        @self.app.route('/')
        def index():
            return render_template('index.html', is_mac=self.is_mac)
        
        @self.app.route('/api/status')
        def status():
            # Generate connection info for mobile devices
            connection_info = {}
            if self.is_mac:
                # Get local IP address
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    s.connect(("8.8.8.8", 80))
                    local_ip = s.getsockname()[0]
                    s.close()
                    
                    # Generate QR code for connection
                    connection_url = f"http://{local_ip}:{self.port}"
                    img = qrcode.make(connection_url)
                    buffered = BytesIO()
                    img.save(buffered, format="PNG")
                    self.qr_code_data = base64.b64encode(buffered.getvalue()).decode("utf-8")
                    
                    connection_info = {
                        "local_ip": local_ip,
                        "port": self.port,
                        "url": connection_url,
                        "qr_code": self.qr_code_data
                    }
                except Exception as e:
                    self.logger.error(f"Error generating connection info: {e}")
            
            return jsonify({
                "status": "running",
                "connected_devices": list(self.client_streams.keys()),
                "active_stream": self.active_stream_id,
                "detector_ready": self.detector is not None,
                "depth_ready": self.depth_estimator is not None,
                "is_mac": self.is_mac,
                "connection_info": connection_info
            })
            
        @self.app.route('/api/qrcode')
        def get_qrcode():
            if not self.is_mac or not self.qr_code_data:
                return jsonify({"error": "QR code not available"}), 404
            return jsonify({
                "qr_code": self.qr_code_data
            })
        
        @self.app.route('/stream/<stream_id>')
        def video_feed(stream_id):
            """Video streaming route for a specific stream ID"""
            def generate():
                while True:
                    if (self.frame_buffer is not None and 
                        self.active_stream_id == stream_id):
                        _, jpeg = cv2.imencode('.jpg', self.frame_buffer)
                        yield (b'--frame\r\n'
                              b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                    time.sleep(0.05)
            
            return Response(generate(),
                           mimetype='multipart/x-mixed-replace; boundary=frame')
        
        @self.app.route('/api/config', methods=['GET', 'POST'])
        def config():
            """Get or update configuration"""
            if request.method == 'GET':
                return jsonify({
                    "show_labels": self.vis.show_labels if self.vis else True,
                    "show_depth": self.vis.show_depth if self.vis else True,
                    "map_mode": False,  # TODO: Implement map mode toggle
                })
            else:
                data = request.json
                if self.vis:
                    if 'show_labels' in data:
                        self.vis.show_labels = data['show_labels']
                    if 'show_depth' in data:
                        self.vis.show_depth = data['show_depth']
                return jsonify({"status": "updated"})
    
    def _configure_socket_events(self):
        """Configure Socket.IO events"""
        
        @self.socketio.on('connect')
        def handle_connect():
            self.logger.info(f"Client connected: {request.sid}")
        
        @self.socketio.on('disconnect')
        def handle_disconnect(sid=None):
            """Handle client disconnect, must accept a parameter as Socket.IO passes session ID"""
            client_sid = sid or request.sid
            self.logger.info(f"Client disconnected: {client_sid}")
            
            if client_sid in self.client_streams:
                del self.client_streams[client_sid]
                self.logger.info(f"Removed stream: {client_sid}")
            
            # If the active stream disconnected, choose a new one if available
            if client_sid == self.active_stream_id:
                if self.client_streams:
                    # Select the first available stream as active
                    new_active_id = next(iter(self.client_streams))
                    stream_info = self.client_streams[new_active_id]
                    self.active_stream_id = new_active_id
                    
                    # Reinitialize the camera model with the new stream's dimensions
                    try:
                        self.logger.info(f"Reinitializing detector for new active stream: {new_active_id}")
                        self.initialize_detector(stream_info["width"], stream_info["height"])
                    except Exception as reinit_error:
                        self.logger.error(f"Error reinitializing detector for new stream: {reinit_error}")
                else:
                    # No more streams, clear active stream
                    self.active_stream_id = None
                    
                    # Don't clear the camera model so it can be used if needed
                    # This prevents NoneType errors if frames arrive late
            
            if not self.client_streams and self.is_processing:
                try:
                    # Use safe version that won't try to join current thread
                    self.safe_stop_processing()
                except Exception as e:
                    self.logger.error(f"Error stopping processing on disconnect: {e}")
        
        @self.socketio.on('register_stream')
        def handle_register_stream(data):
            """Register a new client camera stream"""
            client_id = request.sid
            stream_info = {
                "client_id": client_id,
                "device_name": data.get("device_name", "Unknown Device"),
                "width": data.get("width", 640),
                "height": data.get("height", 480),
                "last_active": time.time()
            }
            
            self.client_streams[client_id] = stream_info
            self.logger.info(f"Registered new stream: {client_id} - {stream_info['device_name']}")
            
            # If this is the first stream, make it active
            if self.active_stream_id is None:
                self.active_stream_id = client_id
                self.initialize_detector(stream_info["width"], stream_info["height"])
                if not self.is_processing:
                    self.start_processing()
            
            return {"status": "registered", "stream_id": client_id}
        
        @self.socketio.on('frame')
        def handle_frame(data):
            """Receive a frame from the client"""
            if request.sid != self.active_stream_id:
                return {"status": "ignored", "reason": "not_active_stream"}
            
            try:
                # Decode base64 image
                img_data = data['image'].split(',')[1]
                import base64
                nparr = np.frombuffer(base64.b64decode(img_data), np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Store the frame for processing
                if frame is not None:
                    self.frame_buffer = frame
                    self.client_streams[request.sid]["last_active"] = time.time()
                    return {"status": "received"}
                else:
                    return {"status": "error", "reason": "invalid_frame"}
            except Exception as e:
                self.logger.error(f"Error processing frame: {e}")
                return {"status": "error", "reason": str(e)}
        
        @self.socketio.on('select_stream')
        def handle_select_stream(data):
            """Select a stream to make active"""
            stream_id = data.get('stream_id')
            if stream_id in self.client_streams:
                self.active_stream_id = stream_id
                stream_info = self.client_streams[stream_id]
                self.initialize_detector(stream_info["width"], stream_info["height"])
                return {"status": "selected", "stream_id": stream_id}
            else:
                return {"status": "error", "reason": "stream_not_found"}
    
    def initialize_detector(self, width: int, height: int):
        """Initialize detector components"""
        self.logger.info("Initializing detector components...")
        self.socketio.emit('initialization_status', {"status": "starting", "message": "Starting initialization..."})
        
        # Progress callback to report status to clients
        def progress_callback(component, message):
            self.logger.info(f"{component}: {message}")
            self.socketio.emit('initialization_status', {
                "status": "progress",
                "component": component,
                "message": message
            })
        
        try:
            # Initialize detector if not already done
            if self.detector is None:
                self.socketio.emit('initialization_status', {
                    "status": "progress", 
                    "component": "detector",
                    "message": "Loading object detector..."
                })
                self.detector = yolo_detector.YOLODetector(
                    progress_callback=progress_callback
                )
            
            # Initialize depth estimator if not already done
            if self.depth_estimator is None:
                self.socketio.emit('initialization_status', {
                    "status": "progress", 
                    "component": "depth",
                    "message": "Loading depth estimator..."
                })
                self.depth_estimator = midas_depth.MiDaSDepthEstimator(
                    progress_callback=progress_callback
                )
            
            # Create or update camera model
            try:
                self.logger.info(f"Initializing camera model with dimensions {width}x{height}")
                self.camera = camera_model.PinholeCamera(width, height)
                self.logger.info("Camera model initialized successfully")
            except Exception as cam_error:
                self.logger.error(f"Error initializing camera model: {cam_error}")
                # If we already have a camera model, keep using it rather than setting to None
                if self.camera is None:
                    self.logger.error("No previous camera model available - some 3D features may not work")
                else:
                    self.logger.warning("Using previous camera model as fallback")
            
            # Initialize visualizer
            try:
                self.vis = visualizer.Visualizer()
                self.logger.info("Visualizer initialized successfully")
            except Exception as viz_init_error:
                self.logger.error(f"Error initializing visualizer: {viz_init_error}")
                self.vis = None
            
            self.logger.info("Detector components initialized")
            self.socketio.emit('initialization_status', {
                "status": "complete",
                "message": "All components initialized successfully"
            })
            
        except Exception as e:
            error_msg = f"Error initializing components: {e}"
            self.logger.error(error_msg)
            self.socketio.emit('initialization_status', {
                "status": "error",
                "message": error_msg
            })
    
    def process_frames(self):
        """Process frames from the active stream"""
        self.logger.info("Starting frame processing thread")
        
        while self.is_processing:
            if self.frame_buffer is not None and self.active_stream_id:
                # Ensure all required components are initialized before processing
                if self.camera is None and self.frame_buffer is not None:
                    self.logger.warning("Camera model is None, attempting to initialize before processing")
                    try:
                        # Get dimensions from the current frame
                        height, width = self.frame_buffer.shape[:2]
                        self.camera = camera_model.PinholeCamera(width, height)
                        self.logger.info(f"Camera model initialized with dimensions {width}x{height}")
                    except Exception as init_error:
                        self.logger.error(f"Failed to initialize camera model: {init_error}")
                        # Continue processing but log the error - we'll try again for each detection
                try:
                    # Make a copy to avoid race conditions
                    frame = self.frame_buffer.copy()
                    
                    # Run detection
                    detections = self.detector.detect(frame)
                    
                    # Estimate depth
                    depth_map, depth_norm = self.depth_estimator.estimate_depth(frame)
                    
                    # Update frame with visualizations
                    if self.vis is None:
                        self.logger.warning("Visualizer is None, reinitializing...")
                        try:
                            self.vis = visualizer.Visualizer()
                            self.logger.info("Visualizer reinitialized successfully")
                        except Exception as viz_reinit_error:
                            self.logger.error(f"Failed to reinitialize visualizer: {viz_reinit_error}")
                    
                    if self.vis:
                        # Get 3D positions for detections
                        for detection in detections:
                            try:
                                # Get bounding box
                                bbox = detection.get('bbox')
                                if not bbox or len(bbox) != 4:
                                    self.logger.warning(f"Invalid bbox: {bbox}")
                                    continue
                                    
                                # Calculate center point
                                x1, y1, x2, y2 = [float(v) for v in bbox]
                                center_x = int((x1 + x2) / 2)
                                center_y = int((y1 + y2) / 2)
                                
                                # Ensure center point is within frame
                                if center_x < 0 or center_y < 0 or center_x >= frame.shape[1] or center_y >= frame.shape[0]:
                                    self.logger.warning(f"Center point out of bounds: ({center_x}, {center_y})")
                                    detection['position_3d'] = (0, 0, 0)
                                    continue
                                
                                # Get depth at center of bbox
                                depth = self.depth_estimator.get_depth_at_point(
                                    depth_norm, center_x, center_y
                                )
                                
                                # Convert to 3D coordinates
                                if depth is not None and not np.isnan(depth):
                                    try:
                                        # Check if camera model is available
                                        if self.camera is None:
                                            self.logger.error("Camera model is None, reinitializing...")
                                            # Get dimensions from the current frame
                                            height, width = frame.shape[:2]
                                            try:
                                                self.camera = camera_model.PinholeCamera(width, height)
                                                self.logger.info(f"Camera model reinitialized with dimensions {width}x{height}")
                                            except Exception as camera_init_error:
                                                self.logger.error(f"Failed to reinitialize camera model: {camera_init_error}")
                                                detection['position_3d'] = [0.0, 0.0, 0.0]
                                                continue
                                        
                                        # Double-check camera model is still available (could be changed by another thread)
                                        if self.camera is None:
                                            self.logger.error("Camera model is still None after reinitialization attempt")
                                            detection['position_3d'] = [0.0, 0.0, 0.0]
                                            continue
                                                
                                        # Now safely attempt to get 3D positions using calibrated depth
                                        try:
                                            world_coords = self.camera.pixel_to_3d(
                                                center_x, center_y, depth, 
                                                normalized_depth=True,
                                                depth_scale=5.0  # Use more realistic scale for better real-world positioning
                                            )
                                        except AttributeError as attr_err:
                                            # This can happen if camera becomes None between the check and the call (race condition)
                                            self.logger.error(f"AttributeError accessing camera model: {attr_err}")
                                            detection['position_3d'] = [0.0, 0.0, 0.0]
                                            continue
                                        except Exception as pixel_err:
                                            self.logger.error(f"Error in pixel_to_3d: {pixel_err}")
                                            detection['position_3d'] = [0.0, 0.0, 0.0]
                                            continue
                                        
                                        # Check if world_coords is valid (not None)
                                        if world_coords is not None:
                                            try:
                                                # Convert each coordinate to float explicitly with safe unpacking
                                                if isinstance(world_coords, (list, tuple)) and len(world_coords) >= 3:
                                                    x, y, z = world_coords
                                                    float_x = float(x)
                                                    float_y = float(y)
                                                    float_z = float(z)
                                                    
                                                    # Verify these are valid numbers
                                                    if not np.isnan(float_x) and not np.isnan(float_y) and not np.isnan(float_z):
                                                        # Store as list of floats for JavaScript compatibility
                                                        detection['position_3d'] = [float_x, float_y, float_z]
                                                        self.logger.debug(f"3D position for {detection.get('class_name')}: {detection['position_3d']}")
                                                    else:
                                                        self.logger.warning(f"NaN values in world coordinates: {world_coords}")
                                                        detection['position_3d'] = [0.0, 0.0, 0.0]
                                                else:
                                                    # Handle the case when world_coords is not iterable or has wrong length
                                                    self.logger.warning(f"Invalid world_coords format: {type(world_coords)}, value: {world_coords}")
                                                    detection['position_3d'] = [0.0, 0.0, 0.0]
                                            except (TypeError, ValueError) as e:
                                                # Catch any unpacking errors
                                                self.logger.error(f"Error unpacking world_coords: {e}, value: {world_coords}")
                                                detection['position_3d'] = [0.0, 0.0, 0.0]
                                        else:
                                            self.logger.debug(f"Invalid 3D coordinates calculated for detection at ({center_x}, {center_y})")
                                            detection['position_3d'] = [0.0, 0.0, 0.0]
                                    except Exception as coord_err:
                                        self.logger.error(f"Error calculating 3D coordinates: {coord_err}")
                                        detection['position_3d'] = [0.0, 0.0, 0.0]
                                else:
                                    self.logger.debug(f"No valid depth for detection at ({center_x}, {center_y})")
                                    detection['position_3d'] = [0.0, 0.0, 0.0]
                            except Exception as pos_error:
                                self.logger.error(f"Error calculating 3D position: {pos_error}")
                                detection['position_3d'] = [0.0, 0.0, 0.0]
                        
                        # Debug detection data
                    self.logger.debug(f"Processing {len(detections)} detections")
                    for i, d in enumerate(detections):
                        self.logger.debug(f"Detection {i}: {d.get('class_name')}, bbox: {d.get('bbox')}, position_3d: {d.get('position_3d')}")
                    
                    # Get 3D positions for visualization
                    positions_3d = [d.get('position_3d', (0, 0, 0)) for d in detections]
                    
                    # Draw visualizations
                    try:
                        # Draw bounding boxes and labels
                        frame = self.vis.draw_detections(frame, detections, positions_3d)
                        self.logger.debug("Visualizations drawn successfully")
                        
                        # Add depth visualization if enabled
                        if self.vis.show_depth:
                            frame = self.vis.add_depth_visualization(frame, depth_norm)
                    except Exception as viz_error:
                        self.logger.error(f"Visualization error: {viz_error}")
                        import traceback
                        self.logger.error(traceback.format_exc())
                    
                    # Update the frame buffer with the processed frame
                    self.frame_buffer = frame
                    
                    # Prepare detection data for clients
                    detection_data = []
                    self.logger.debug(f"Processing {len(detections)} detections for emit")
                    
                    for d in detections:
                        try:
                            # Ensure bbox is valid before including the detection
                            bbox = d.get('bbox')
                            if not bbox or len(bbox) != 4:
                                self.logger.warning(f"Detection missing valid bbox: {d.get('class_name')}")
                                continue
                                
                            # Ensure all bbox values are numeric
                            try:
                                bbox_values = [float(v) for v in bbox]
                                # Ensure bbox values are within frame
                                if any(v < 0 for v in bbox_values[:2]) or any(v > 5000 for v in bbox_values[2:]):
                                    self.logger.warning(f"Detection has out-of-bounds bbox: {bbox_values}")
                                    continue
                            except (ValueError, TypeError):
                                self.logger.warning(f"Non-numeric values in bbox: {bbox}")
                                continue
                                
                            # Basic required fields
                            data = {
                                "label": d.get('class_name', 'unknown'),
                                "confidence": float(d.get('confidence', 0.0)),
                                "bbox": bbox_values,
                                "position_3d": None
                            }
                            
                            # Add 3D position data if available
                            if 'position_3d' in d and d['position_3d'] is not None:
                                pos = d['position_3d']
                                if isinstance(pos, (list, tuple)) and len(pos) >= 3:
                                    # Convert all position values to float and validate each one
                                    try:
                                        pos_data = [float(v) for v in pos[:3]]
                                        
                                        # Check for any invalid values
                                        if any(np.isnan(v) for v in pos_data) or any(np.isinf(v) for v in pos_data):
                                            self.logger.warning(f"NaN or Inf in position data: {pos_data}")
                                            # Use zeros instead of None to ensure position_3d is always an array
                                            data["position_3d"] = [0.0, 0.0, 0.0]
                                        elif all(np.abs(v) < 1000 for v in pos_data):
                                            data["position_3d"] = pos_data
                                        else:
                                            self.logger.warning(f"Position values out of range: {pos_data}")
                                            data["position_3d"] = [0.0, 0.0, 0.0]
                                    except (ValueError, TypeError) as val_err:
                                        self.logger.warning(f"Error converting position values: {val_err}")
                                        data["position_3d"] = [0.0, 0.0, 0.0]
                                else:
                                    self.logger.warning(f"Invalid position format: {pos}")
                                    data["position_3d"] = [0.0, 0.0, 0.0]
                            else:
                                # Always include position_3d array even if empty
                                data["position_3d"] = [0.0, 0.0, 0.0]
                            
                            detection_data.append(data)
                            
                        except Exception as det_error:
                            self.logger.error(f"Error processing detection for emit: {det_error}")
                            continue
                    
                    # Send data to clients with validation
                    if detection_data:
                        self.logger.debug(f"Emitting {len(detection_data)} detections to clients")
                        
                        # Check the first few detections for position_3d data
                        has_positions = any(d.get('position_3d') is not None for d in detection_data[:5])
                        if not has_positions:
                            self.logger.warning("No valid position_3d data in detections")
                        
                        self.socketio.emit('detection_results', {
                            "detections": detection_data,
                            "timestamp": time.time()
                        })
                    else:
                        self.logger.debug("No valid detections to emit")
                    
                except Exception as e:
                    self.logger.error(f"Error in processing thread: {e}")
            
            # Sleep to reduce CPU usage
            time.sleep(0.01)
    
    def start_processing(self):
        """Start the frame processing thread"""
        if not self.is_processing:
            self.is_processing = True
            self.processing_thread = threading.Thread(target=self.process_frames)
            self.processing_thread.daemon = True
            self.processing_thread.start()
    
    def safe_stop_processing(self):
        """Safely stop processing without attempting to join from the same thread"""
        self.logger.info("Safely stopping processing")
        self.is_processing = False
        # Don't attempt to join threads - just mark it for stopping
        
    def stop_processing(self):
        """Stop the frame processing thread"""
        self.logger.info("Stopping processing thread")
        self.is_processing = False
        
        # Only join the thread if we're not in the same thread
        if self.processing_thread and self.processing_thread != threading.current_thread():
            try:
                self.processing_thread.join(timeout=1.0)
                self.processing_thread = None
                self.logger.info("Processing thread stopped successfully")
            except RuntimeError as e:
                self.logger.error(f"Error joining processing thread: {e}")
        else:
            self.logger.info("Processing thread marked for stopping (same thread or None)")
    
    def start(self):
        """Start the web server"""
        self.logger.info(f"Starting server on {self.host}:{self.port}")
        self.socketio.run(self.app, host=self.host, port=self.port, debug=True, allow_unsafe_werkzeug=True)
    
    def shutdown(self):
        """Shutdown the server and cleanup resources"""
        self.stop_processing()
        # Additional cleanup can be added here


def main():
    """Entry point for web server"""
    server = WebServer()
    server.start()


if __name__ == "__main__":
    main()