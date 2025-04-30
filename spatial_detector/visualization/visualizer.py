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
            try:
                # Get bounding box 
                x1, y1, x2, y2 = detection['bbox']
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                # Get label and confidence
                label = detection['class_name']
                conf = detection['confidence']
                
                # Generate random but consistent color based on label
                label_hash = sum(ord(c) for c in label)
                color = (
                    (label_hash * 123) % 255,  # B
                    (label_hash * 147) % 255,  # G
                    (label_hash * 109) % 255   # R
                )
                
                # Draw bounding box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                
                # Draw label with confidence
                label_text = f"{label} ({conf:.2f})"
                
                # Add 3D position if available
                position_3d = detection.get('position_3d')
                if position_3d is not None:
                    X, Y, Z = position_3d
                    depth_info = f" {Z:.1f}m"
                    label_text += depth_info
                
                if self.show_labels:
                    # Create background for text
                    text_size = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                    cv2.rectangle(
                        annotated_frame, 
                        (x1, y1 - 25),
                        (x1 + text_size[0] + 10, y1),
                        (0, 0, 0), 
                        -1
                    )
                    
                    # Draw text
                    cv2.putText(
                        annotated_frame, 
                        label_text,
                        (x1 + 5, y1 - 7),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.5, 
                        color, 
                        2
                    )
            except Exception as e:
                print(f"Error drawing detection {i}: {e}")
                continue
                
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