#!/usr/bin/env python3
import cv2
import argparse
import sys
import os
import time
import numpy as np
import torch

from spatial_detector.detection import YOLODetector
from spatial_detector.depth import MiDaSDepthEstimator
from spatial_detector.projection import PinholeCamera
from spatial_detector.visualization import Visualizer
from spatial_detector.mapping import SpatialMap, DepthCalibrator

def main():
    parser = argparse.ArgumentParser(description="3D Object Detection with Spatial Mapping")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--yolo-model", default="yolov8n.pt", help="YOLO model to use")
    parser.add_argument("--confidence", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--device", help="Computation device (mps, cpu, or auto)")
    parser.add_argument("--calibration", help="Camera calibration file")
    parser.add_argument("--depth-calibration", help="Depth calibration file")
    parser.add_argument("--record", help="Path to save video recording")
    parser.add_argument("--width", type=int, default=640, help="Camera width")
    parser.add_argument("--height", type=int, default=480, help="Camera height")
    parser.add_argument("--room-width", type=float, default=5.0, help="Room width in meters")
    parser.add_argument("--room-depth", type=float, default=5.0, help="Room depth in meters")
    args = parser.parse_args()
    
    # Detect best available device for Apple Silicon
    if args.device:
        device = args.device
    else:
        # Check for MPS (Metal Performance Shaders) for M1/M2 Macs
        if torch.backends.mps.is_available():
            device = "mps"
            print("Using Apple M1/M2 GPU acceleration (MPS)")
        elif torch.cuda.is_available():
            device = "cuda"
            print("Using NVIDIA GPU acceleration (CUDA)")
        else:
            device = "cpu"
            print("Using CPU for computation")
    
    # Initialize components
    detector = YOLODetector(model_path=args.yolo_model, confidence=args.confidence, device=device)
    depth_estimator = MiDaSDepthEstimator(device=device)
    camera = PinholeCamera(image_size=(args.width, args.height))
    visualizer = Visualizer(show_depth=True, show_labels=True)
    
    # Initialize new components
    depth_calibrator = DepthCalibrator(calibration_file=args.depth_calibration)
    spatial_map = SpatialMap(room_dimensions=(args.room_width, args.room_depth))
    
    # Load camera calibration if provided
    if args.calibration:
        camera.load_calibration(args.calibration)
    
    # Open webcam
    print(f"Opening webcam at index {args.camera}...")
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Error: Could not open webcam at index {args.camera}")
        return 1
    
    # Set webcam resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    
    # Get actual webcam properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"Webcam resolution: {width}x{height}, FPS: {fps}")
    
    # Set up video writer if recording
    out = None
    if args.record:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(args.record, fourcc, fps, (width*2, height))
    
    # Create windows
    main_window = '3D Object Detection'
    map_window = 'Spatial Map'
    cv2.namedWindow(main_window, cv2.WINDOW_NORMAL)
    cv2.namedWindow(map_window, cv2.WINDOW_NORMAL)
    
    # FPS calculation variables
    frame_count = 0
    start_time = time.time()
    fps_display = 0
    
    # Calibration mode variables
    calibration_mode = False
    calibration_distance = 1.0  # Default distance in meters
    
    print("\nControls:")
    print("  'q': Quit")
    print("  'd': Toggle depth visualization")
    print("  'l': Toggle labels")
    print("  'm': Toggle map mode (topdown/3D)")
    print("  'c': Enter calibration mode")
    print("  '+'/'-': Adjust calibration distance")
    print("  'space': Set calibration point in calibration mode")
    print("  's': Save depth calibration")
    
    # Process webcam feed
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture image from webcam")
            break
        
        # Update FPS calculation
        frame_count += 1
        elapsed_time = time.time() - start_time
        if elapsed_time >= 1.0:  # Update FPS every second
            fps_display = frame_count / elapsed_time
            frame_count = 0
            start_time = time.time()
        
        # Detect objects
        detections = detector.detect(frame)
        
        # Estimate depth
        raw_depth_map, depth_norm = depth_estimator.estimate_depth(frame)
        
        # Convert to metric depth using calibration
        metric_depth_map = depth_calibrator.depth_to_meters(depth_norm)
        
        # Project to 3D
        positions_3d = []
        for detection in detections:
            center_x, center_y = detection['center']
            # Get normalized depth
            normalized_depth = depth_estimator.get_depth_at_point(depth_norm, center_x, center_y)
            if normalized_depth is not None:
                # Convert to metric depth
                metric_depth = depth_calibrator.depth_to_meters(normalized_depth)
                # Project to 3D
                position_3d = camera.pixel_to_3d(center_x, center_y, metric_depth, normalized_depth=False)
                positions_3d.append(position_3d)
            else:
                # Use a fallback depth if point is invalid
                positions_3d.append((0, 0, 0))
        
        # Update spatial map
        spatial_map.update(detections, positions_3d)
        
        # Visualize
        if calibration_mode:
            # Draw calibration target in the center
            center_x, center_y = width // 2, height // 2
            cv2.circle(frame, (center_x, center_y), 10, (0, 0, 255), 2)
            cv2.line(frame, (center_x - 15, center_y), (center_x + 15, center_y), (0, 0, 255), 2)
            cv2.line(frame, (center_x, center_y - 15), (center_x, center_y + 15), (0, 0, 255), 2)
            
            # Add calibration instructions
            cv2.putText(frame, "CALIBRATION MODE", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            cv2.putText(frame, f"Place object at exactly {calibration_distance:.2f}m", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            cv2.putText(frame, "Press SPACE to calibrate, +/- to adjust distance", (10, 90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            # Get depth at calibration point
            calibration_depth = depth_estimator.get_depth_at_point(depth_norm, center_x, center_y)
            if calibration_depth is not None:
                current_estimate = depth_calibrator.depth_to_meters(calibration_depth)
                cv2.putText(frame, f"Current estimate: {current_estimate:.2f}m", (10, 120), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            # Use depth visualization as background
            depth_viz = depth_calibrator.visualize_depth(metric_depth_map, frame)
            annotated_frame = depth_viz
        else:
            # Regular object detection visualization
            annotated_frame = visualizer.draw_detections(frame, detections, positions_3d)
            
            # Add depth overlay if enabled
            if visualizer.show_depth:
                depth_viz = depth_calibrator.visualize_depth(metric_depth_map)
                # Place depth visualization in corner
                h, w = annotated_frame.shape[:2]
                depth_h = int(h * 0.25)  # 25% of height
                depth_w = int(w * 0.25)  # 25% of width
                small_depth = cv2.resize(depth_viz, (depth_w, depth_h))
                annotated_frame[0:depth_h, 0:depth_w] = small_depth
        
        # Add FPS counter
        cv2.putText(annotated_frame, f"FPS: {fps_display:.1f}", (width - 120, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Generate map visualization
        map_viz = spatial_map.get_topdown_view(width=400, height=400)
        
        # Create combined visualization for recording
        if out:
            # Resize map to match frame height
            map_viz_resized = cv2.resize(map_viz, (height * map_viz.shape[1] // map_viz.shape[0], height))
            # Create black padding if needed
            padding = width - map_viz_resized.shape[1]
            if padding > 0:
                map_viz_resized = cv2.copyMakeBorder(map_viz_resized, 0, 0, 0, padding, 
                                                    cv2.BORDER_CONSTANT, value=(0, 0, 0))
            # Combine frame and map side by side
            combined_frame = cv2.hconcat([annotated_frame, map_viz_resized])
            out.write(combined_frame)
        
        # Display frames
        cv2.imshow(main_window, annotated_frame)
        cv2.imshow(map_window, map_viz)
        
        # Handle key presses
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("Quitting...")
            break
        elif key == ord('d'):
            visualizer.show_depth = not visualizer.show_depth
            print(f"Depth visualization: {'On' if visualizer.show_depth else 'Off'}")
        elif key == ord('l'):
            visualizer.show_labels = not visualizer.show_labels
            print(f"Labels: {'On' if visualizer.show_labels else 'Off'}")
        elif key == ord('c'):
            calibration_mode = not calibration_mode
            print(f"Calibration mode: {'On' if calibration_mode else 'Off'}")
        elif key == ord('+') or key == ord('='):
            calibration_distance += 0.1
            print(f"Calibration distance: {calibration_distance:.2f}m")
        elif key == ord('-'):
            calibration_distance = max(0.1, calibration_distance - 0.1)
            print(f"Calibration distance: {calibration_distance:.2f}m")
        elif key == ord(' ') and calibration_mode:
            # Perform calibration at center point
            center_x, center_y = width // 2, height // 2
            calibration_depth = depth_estimator.get_depth_at_point(depth_norm, center_x, center_y)
            if calibration_depth is not None:
                depth_calibrator.calibrate_with_known_distance(calibration_depth, calibration_distance)
                print(f"Calibrated depth at {calibration_distance:.2f}m")
        elif key == ord('s'):
            # Save calibration
            if args.depth_calibration:
                depth_calibrator.save_calibration(args.depth_calibration)
            else:
                depth_calibrator.save_calibration("depth_calibration.json")
    
    # Clean up
    cap.release()
    if out:
        out.release()
    cv2.destroyAllWindows()
    
    print("Webcam detection stopped")
    return 0

if __name__ == "__main__":
    sys.exit(main())