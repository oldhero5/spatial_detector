import cv2
import numpy as np

class Visualizer:
    """
    Visualization utilities for 3D object detection.
    """
    def __init__(self, show_depth=True, show_labels=True, depth_map_size=0.25):
        """
        Initialize visualizer.
        
        Args:
            show_depth: Whether to show depth map visualization
            show_labels: Whether to show labels and 3D coordinates
            depth_map_size: Size of depth map visualization as fraction of frame
        """
        self.show_depth = show_depth
        self.show_labels = show_labels
        self.depth_map_size = depth_map_size
        
    def draw_detections(self, frame, detections, positions_3d=None):
        """
        Draw detected objects on frame.
        
        Args:
            frame: Original RGB frame
            detections: List of detection dictionaries
            positions_3d: List of (X, Y, Z) positions corresponding to detections
            
        Returns:
            annotated_frame: Frame with visualizations
        """
        annotated_frame = frame.copy()
        
        for i, detection in enumerate(detections):
            x1, y1, x2, y2 = detection['bbox']
            label = detection['class_name']
            conf = detection['confidence']
            
            # Draw bounding box
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Draw label with confidence
            label_text = f"{label} ({conf:.2f})"
            
            # Add 3D position if available
            if positions_3d and i < len(positions_3d):
                X, Y, Z = positions_3d[i]
                label_text += f" - 3D: ({X:.2f}, {Y:.2f}, {Z:.2f})"
                
            if self.show_labels:
                cv2.putText(annotated_frame, label_text, (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
        return annotated_frame
        
    def add_depth_visualization(self, frame, depth_normalized):
        """
        Add depth map visualization to corner of frame.
        
        Args:
            frame: Original or annotated frame
            depth_normalized: Normalized depth map (0-1)
            
        Returns:
            frame_with_depth: Frame with depth visualization
        """
        if not self.show_depth:
            return frame
            
        # Apply colormap to depth
        depth_colormap = cv2.applyColorMap(
            (depth_normalized * 255).astype(np.uint8),
            cv2.COLORMAP_JET
        )
        
        # Resize depth map for corner display
        h, w = frame.shape[:2]
        depth_h = int(h * self.depth_map_size)
        depth_w = int(w * self.depth_map_size)
        small_depth = cv2.resize(depth_colormap, (depth_w, depth_h))
        
        # Add depth map to corner of frame
        frame_with_depth = frame.copy()
        frame_with_depth[0:depth_h, 0:depth_w] = small_depth
        
        return frame_with_depth