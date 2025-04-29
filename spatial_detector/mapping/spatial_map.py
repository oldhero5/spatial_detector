"""
Spatial mapping module for tracking and visualizing objects in 3D space.
"""

import numpy as np
import cv2
from typing import List, Tuple, Dict, Any, Optional


class SpatialMap:
    """
    Creates and maintains a spatial representation of detected objects.
    """
    
    def __init__(self, room_dimensions: Tuple[float, float] = (5.0, 5.0)):
        """
        Initialize the spatial map.
        
        Args:
            room_dimensions: (width, depth) of the room in meters
        """
        self.room_width, self.room_depth = room_dimensions
        self.tracked_objects = {}
        self.last_positions = {}
        self.object_history = {}
        self.max_history = 10
        self.map_resolution = 100  # pixels per meter
        
    def update(self, detections: List[Dict[str, Any]], positions_3d: List[Tuple[float, float, float]]):
        """
        Update the spatial map with new detections.
        
        Args:
            detections: List of detection results from the detector
            positions_3d: List of 3D positions corresponding to each detection
        """
        # Create a blank top-down view
        current_positions = {}
        
        for i, (detection, position) in enumerate(zip(detections, positions_3d)):
            # Extract data
            label = detection.get('class_name', 'unknown')
            confidence = detection.get('confidence', 0.0)
            object_id = f"{label}_{i}"
            
            # Skip if position is zero (invalid)
            if position == (0, 0, 0):
                continue
                
            # Extract position (x, y, z)
            x, y, z = position
            
            # Store position (relative to camera)
            current_positions[object_id] = {
                'label': label,
                'position': position,
                'confidence': confidence,
                'timestamp': cv2.getTickCount() / cv2.getTickFrequency()
            }
            
            # Update history
            if object_id not in self.object_history:
                self.object_history[object_id] = []
            
            self.object_history[object_id].append(position)
            if len(self.object_history[object_id]) > self.max_history:
                self.object_history[object_id].pop(0)
        
        # Update tracked objects
        self.last_positions = current_positions
        
    def get_topdown_view(self, width: int = 400, height: int = 400) -> np.ndarray:
        """
        Generate a top-down view visualization of the spatial map.
        
        Args:
            width: Width of the output visualization
            height: Height of the output visualization
            
        Returns:
            Top-down view image
        """
        # Create a blank top-down view (white background)
        map_image = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Calculate scaling factors
        scale_x = width / self.room_width
        scale_z = height / self.room_depth
        
        # Draw grid lines
        grid_color = (200, 200, 200)
        grid_size = 1.0  # 1-meter grid
        
        # Vertical grid lines
        for x in np.arange(0, self.room_width + grid_size, grid_size):
            x_pixel = int(x * scale_x)
            cv2.line(map_image, (x_pixel, 0), (x_pixel, height), grid_color, 1)
            
        # Horizontal grid lines
        for z in np.arange(0, self.room_depth + grid_size, grid_size):
            z_pixel = int(z * scale_z)
            cv2.line(map_image, (0, z_pixel), (width, z_pixel), grid_color, 1)
        
        # Draw camera position (center bottom)
        camera_x = width // 2
        camera_y = height - 20
        camera_color = (0, 0, 0)
        
        # Camera triangle
        cv2.drawMarker(map_image, (camera_x, camera_y), camera_color, 
                      markerType=cv2.MARKER_TRIANGLE_UP, markerSize=20, thickness=2)
        
        # Field of view lines
        fov_angle = 60  # degrees
        fov_length = height // 2
        
        angle_rad = np.deg2rad(fov_angle / 2)
        dx = int(fov_length * np.sin(angle_rad))
        dy = int(fov_length * np.cos(angle_rad))
        
        cv2.line(map_image, (camera_x, camera_y), (camera_x - dx, camera_y - dy), camera_color, 1)
        cv2.line(map_image, (camera_x, camera_y), (camera_x + dx, camera_y - dy), camera_color, 1)
        
        # Draw all tracked objects
        for obj_id, data in self.last_positions.items():
            position = data['position']
            label = data['label']
            
            # Extract position (x is left/right, z is depth)
            obj_x, obj_y, obj_z = position
            
            # Convert to pixel coordinates (origin at bottom center)
            # X axis: left/right from camera (negative is left)
            # Z axis: depth from camera (negative is forward)
            pixel_x = int(camera_x + obj_x * scale_x)
            pixel_y = int(camera_y - obj_z * scale_z)  # Invert Z because pixel y increases downward
            
            # Check if point is within map boundaries
            if 0 <= pixel_x < width and 0 <= pixel_y < height:
                # Determine color by object type
                colors = {
                    'person': (0, 128, 255),    # Orange
                    'car': (0, 0, 255),         # Red
                    'truck': (0, 0, 200),       # Dark red
                    'bicycle': (255, 0, 0),     # Blue
                    'motorcycle': (255, 0, 128),# Purple
                    'bus': (0, 0, 128),         # Dark blue
                    'dog': (0, 255, 0),         # Green
                    'cat': (0, 255, 128),       # Light green
                }
                color = colors.get(label, (255, 0, 255))  # Magenta for unknown
                
                # Draw the object
                cv2.circle(map_image, (pixel_x, pixel_y), 10, color, -1)
                
                # Draw trajectory if available
                if obj_id in self.object_history and len(self.object_history[obj_id]) > 1:
                    history = self.object_history[obj_id]
                    for i in range(1, len(history)):
                        prev_x, prev_y, prev_z = history[i-1]
                        curr_x, curr_y, curr_z = history[i]
                        
                        prev_px = int(camera_x + prev_x * scale_x)
                        prev_py = int(camera_y - prev_z * scale_z)
                        curr_px = int(camera_x + curr_x * scale_x)
                        curr_py = int(camera_y - curr_z * scale_z)
                        
                        # Check if points are within map boundaries
                        if (0 <= prev_px < width and 0 <= prev_py < height and
                            0 <= curr_px < width and 0 <= curr_py < height):
                            cv2.line(map_image, (prev_px, prev_py), (curr_px, curr_py), color, 2)
                
                # Draw label
                text_color = (255, 255, 255)
                cv2.putText(map_image, label, (pixel_x - 20, pixel_y - 15), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Draw distance
                distance = np.sqrt(obj_x**2 + obj_z**2)
                cv2.putText(map_image, f"{distance:.1f}m", (pixel_x - 20, pixel_y + 15),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        # Draw legend
        self._draw_legend(map_image)
        
        # Draw compass for orientation
        self._draw_compass(map_image, width, height)
        
        # Border
        cv2.rectangle(map_image, (0, 0), (width-1, height-1), (0, 0, 0), 2)
        
        return map_image
    
    def _draw_legend(self, image: np.ndarray):
        """Draw legend showing distance scale"""
        h, w = image.shape[:2]
        legend_h = 30
        legend_w = 100
        legend_x = 10
        legend_y = h - 40
        
        # Draw the scale bar
        cv2.rectangle(image, (legend_x, legend_y), (legend_x + legend_w, legend_y + 5), (0, 0, 0), -1)
        
        # Add labels
        cv2.putText(image, "0m", (legend_x, legend_y + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        cv2.putText(image, f"{self.room_width*(legend_w/w):.1f}m", (legend_x + legend_w - 25, legend_y + 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        
        cv2.putText(image, "Scale", (legend_x + 35, legend_y - 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
    
    def _draw_compass(self, image: np.ndarray, width: int, height: int):
        """Draw a simple compass showing orientation"""
        compass_radius = 25
        compass_x = width - compass_radius - 10
        compass_y = compass_radius + 10
        
        # Draw circle
        cv2.circle(image, (compass_x, compass_y), compass_radius, (200, 200, 200), 1)
        
        # Draw directional indicators
        # North (away from camera)
        cv2.line(image, (compass_x, compass_y), (compass_x, compass_y - compass_radius), (0, 0, 0), 2)
        cv2.putText(image, "N", (compass_x - 5, compass_y - compass_radius - 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0,.0), 1)
        
        # East (right of camera)
        cv2.line(image, (compass_x, compass_y), (compass_x + compass_radius, compass_y), (0, 0, 0), 1)
        cv2.putText(image, "E", (compass_x + compass_radius + 5, compass_y + 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        
        # South (toward camera)
        cv2.line(image, (compass_x, compass_y), (compass_x, compass_y + compass_radius), (0, 0, 0), 1)
        cv2.putText(image, "S", (compass_x - 5, compass_y + compass_radius + 15),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        
        # West (left of camera)
        cv2.line(image, (compass_x, compass_y), (compass_x - compass_radius, compass_y), (0, 0, 0), 1)
        cv2.putText(image, "W", (compass_x - compass_radius - 15, compass_y + 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)