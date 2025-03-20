#!/usr/bin/env python3
import cv2
import argparse
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.detection.yolo_detector import YOLODetector
from src.depth.midas_depth import MiDaSDepthEstimator
from src.projection.camera_model import PinholeCamera
from src.visualization.visualizer import Visualizer

def main():
    parser = argparse.ArgumentParser(description="3D Object Detection for Video Files")
    parser.add_argument("input", help="Path to input video file")
    parser.add_argument("--output", help="Path to output video file")
    parser.add_argument("--yolo-model", default="yolov8n.pt", help="YOLO model to use")
    parser.add_argument("--confidence", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--device", help="Computation device (cuda or cpu)")
    parser.add_argument("--calibration", help="Camera calibration file")
    args = parser.parse_args()
    
    # Initialize components
    detector = YOLODetector(model_path=args.yolo_model, confidence=args.confidence, device=args.device)
    depth_estimator = MiDaSDepthEstimator(device=args.device)
    camera = PinholeCamera()
    visualizer = Visualizer()
    
    # Load camera calibration if provided
    if args.calibration:
        camera.load_calibration(args.calibration)
    
    # Open input video
    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        print(f"Error: Could not open video file {args.input}")
        return 1
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Set up video writer if output path is specified
    out = None
    if args.output:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(args.output, fourcc, fps, (width, height))
    
    # Process video
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Update progress
        frame_count += 1
        print(f"Processing frame {frame_count}/{total_frames} ({frame_count/total_frames*100:.1f}%)", end="\r")
        
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
        
        # Write to output video
        if out:
            out.write(final_frame)
        
        # Display frame
        cv2.imshow('3D Object Detection', final_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Clean up
    cap.release()
    if out:
        out.release()
    cv2.destroyAllWindows()
    
    print(f"\nProcessing complete. Output saved to {args.output}" if args.output else "\nProcessing complete.")
    return 0

if __name__ == "__main__":
    sys.exit(main())