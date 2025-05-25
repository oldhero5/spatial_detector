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
        if frame is None:
            print("Error: Frame is None")
            return None

        if not isinstance(detections, list):
            print(f"Error: detections is not a list: {type(detections)}")
            return frame.copy()

        if len(detections) == 0:
            return frame.copy()

        # Safety check - ensure we're working with a copy, not the original
        try:
            annotated_frame = frame.copy()
        except Exception as e:
            print(f"Error copying frame: {e}")
            annotated_frame = frame

        # Draw each detection
        for i, detection in enumerate(detections):
            try:
                # Check for required fields
                if "bbox" not in detection or "class_name" not in detection:
                    print(f"Detection {i} missing required fields: {detection.keys()}")
                    continue

                # Get bounding box and convert to integers
                bbox = detection["bbox"]
                if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
                    print(f"Invalid bbox format: {bbox}")
                    continue

                try:
                    x1, y1, x2, y2 = [int(float(v)) for v in bbox]
                except (ValueError, TypeError) as e:
                    print(f"Error converting bbox values: {e}")
                    continue

                # Get label and confidence
                label = str(detection.get("class_name", "unknown"))
                conf = float(detection.get("confidence", 0.0))

                # Generate consistent color based on label
                label_hash = sum(ord(c) for c in label)
                color = (
                    (label_hash * 123) % 255,  # B
                    (label_hash * 147) % 255,  # G
                    (label_hash * 109) % 255,  # R
                )

                # Validate bounding box is within frame
                h, w = annotated_frame.shape[:2]
                x1 = max(0, min(x1, w - 1))
                y1 = max(0, min(y1, h - 1))
                x2 = max(0, min(x2, w - 1))
                y2 = max(0, min(y2, h - 1))

                # Draw bounding box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)

                # Draw label with confidence
                label_text = f"{label} ({conf:.2f})"

                # Add 3D position if available
                position_3d = detection.get("position_3d")
                if position_3d is not None and len(position_3d) >= 3:
                    try:
                        X, Y, Z = [float(v) for v in position_3d[:3]]
                        if not any(np.isnan([X, Y, Z])):
                            depth_info = f" {Z:.1f}m"
                            label_text += depth_info
                    except (ValueError, TypeError) as e:
                        print(f"Error processing position_3d: {e}, {position_3d}")

                if self.show_labels:
                    try:
                        # Create background for text
                        text_size = cv2.getTextSize(
                            label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2
                        )[0]

                        # Check if text would go out of bounds
                        text_x1 = x1
                        text_y1 = max(25, y1) - 25  # Ensure we don't go negative
                        text_x2 = min(text_x1 + text_size[0] + 10, w - 1)
                        text_y2 = min(text_y1 + 25, h - 1)

                        cv2.rectangle(
                            annotated_frame,
                            (text_x1, text_y1),
                            (text_x2, text_y2),
                            (0, 0, 0),
                            -1,
                        )

                        # Draw text
                        cv2.putText(
                            annotated_frame,
                            label_text,
                            (text_x1 + 5, text_y1 + 18),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            color,
                            2,
                        )
                    except Exception as text_err:
                        print(f"Error drawing text: {text_err}")

            except Exception as e:
                print(f"Error drawing detection {i}: {e}")
                import traceback

                print(traceback.format_exc())
                continue

        # Add a visible marker to show visualization is working
        try:
            # Add a small colored marker in the top-right corner
            h, w = annotated_frame.shape[:2]
            marker_size = 30
            marker_color = (0, 255, 0)  # Green
            cv2.rectangle(
                annotated_frame,
                (w - marker_size, 0),
                (w, marker_size),
                marker_color,
                -1,
            )
        except Exception as marker_err:
            print(f"Error adding marker: {marker_err}")

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

        if frame is None:
            print("Error: Frame is None in add_depth_visualization")
            return None

        try:
            # Safety check for depth map
            if depth_normalized is None:
                print("Error: depth_normalized is None")
                return frame

            # Convert to float32 if needed and ensure in 0-1 range
            if not isinstance(depth_normalized, np.ndarray):
                print(
                    f"Error: depth_normalized is not a numpy array: {type(depth_normalized)}"
                )
                return frame

            # Make a copy to avoid modifying original
            depth_for_viz = depth_normalized.copy()

            # Ensure in 0-1 range
            if depth_for_viz.max() > 0:
                depth_for_viz = (depth_for_viz - depth_for_viz.min()) / (
                    depth_for_viz.max() - depth_for_viz.min()
                )

            # Apply colormap to depth
            depth_colormap = cv2.applyColorMap(
                (depth_for_viz * 255).astype(np.uint8), cv2.COLORMAP_JET
            )

            # Resize depth map for corner display
            h, w = frame.shape[:2]
            depth_h = int(h * self.depth_map_size)
            depth_w = int(w * self.depth_map_size)
            small_depth = cv2.resize(depth_colormap, (depth_w, depth_h))

            # Add depth map to corner of frame
            frame_with_depth = frame.copy()
            frame_with_depth[0:depth_h, 0:depth_w] = small_depth

            # Add border around depth map
            cv2.rectangle(
                frame_with_depth, (0, 0), (depth_w, depth_h), (255, 255, 255), 1
            )

            # Add "Depth" label
            cv2.putText(
                frame_with_depth,
                "Depth",
                (5, depth_h - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (255, 255, 255),
                1,
            )

            return frame_with_depth

        except Exception as e:
            print(f"Error in add_depth_visualization: {e}")
            import traceback

            print(traceback.format_exc())
            return frame
