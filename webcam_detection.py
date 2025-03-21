#!/usr/bin/env python3
import cv2
import argparse
import sys
import os
import time

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.detection.yolo_detector import YOLODetector
from src.depth.midas_depth import MiDaSDepthEstimator
from src.projection.camera_model import PinholeCamera
from src.visualization.visualizer import Visualizer
import torch

def main():
    parser = argparse.ArgumentParser(description="3D Object Detection for Webcam")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--yolo-model", default="yolov8n.pt", help="YOLO model to use")
    parser.add_argument("--confidence", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--device", help="Computation device (mps, cpu, or auto)")
    parser.add_argument("--calibration", help="Camera calibration file")
    parser.add_argument("--record", help="Path to save video recording")
    parser.add_argument("--width", type=int, default=640, help="Camera width")
    parser.add_argument("--height", type=int, default=480, help="Camera height")
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
        out = cv2.VideoWriter(args.record, fourcc, fps, (width, height))
    
    # Create window
    window_name = '3D Object Detection'
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    
    # FPS calculation variables
    frame_count = 0
    start_time = time.time()
    fps_display = 0
    
    print("Press 'q' to quit, 'd' to toggle depth visualization, 'l' to toggle labels")
    
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
        depth_map, depth_norm = depth_estimator.estimate_depth(frame)
        
        # Project to 3D
        positions_3d = []
        for detection in detections:
            center_x, center_y = detection['center']
            depth_value = depth_estimator.get_depth_at_point(depth_map, center_x, center_y)
            position_3d = camera.pixel_to_3d(center_x, center_y, depth_value)
            positions_3d.append(position_3d)
        
        # Visualize
        annotated_frame = visualizer.draw_detections(frame, detections, positions_3d)
        final_frame = visualizer.add_depth_visualization(annotated_frame, depth_norm)
        
        # Add FPS counter
        cv2.putText(final_frame, f"FPS: {fps_display:.1f}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        # Write to output video if recording
        if out:
            out.write(final_frame)
        
        # Display frame
        cv2.imshow(window_name, final_frame)
        
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
    
    # Clean up
    cap.release()
    if out:
        out.release()
    cv2.destroyAllWindows()
    
    print("Webcam detection stopped")
    return 0

if __name__ == "__main__":
    sys.exit(main())