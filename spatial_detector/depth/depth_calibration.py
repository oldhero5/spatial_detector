import numpy as np
import cv2
import json
import os

class DepthCalibrator:
    """
    Calibrates MiDaS depth output to real-world measurements.
    """
    def __init__(self, calibration_file=None):
        """
        Initialize the depth calibrator.
        
        Args:
            calibration_file: Optional path to a saved calibration file
        """
        # Default calibration parameters
        self.scale_factor = 10.0  # Initial guess
        self.offset = 0.0
        self.min_depth = 0.5  # Minimum valid depth in meters
        self.max_depth = 10.0  # Maximum valid depth in meters
        
        # Try to load calibration if file is specified
        if calibration_file and os.path.exists(calibration_file):
            self.load_calibration(calibration_file)
            
    def normalize_depth(self, depth_map):
        """
        Normalize depth map to range [0, 1].
        
        Args:
            depth_map: Raw depth map from MiDaS
            
        Returns:
            normalized_depth: Depth map normalized to [0, 1]
        """
        depth_min = depth_map.min()
        depth_max = depth_map.max()
        
        # Avoid division by zero
        if depth_max - depth_min > 0:
            normalized_depth = (depth_map - depth_min) / (depth_max - depth_min)
        else:
            normalized_depth = np.zeros_like(depth_map)
            
        return normalized_depth
    
    def depth_to_meters(self, normalized_depth):
        """
        Convert normalized depth to metric depth (in meters).
        
        Args:
            normalized_depth: Normalized depth value [0, 1]
            
        Returns:
            metric_depth: Depth in meters
        """
        # Apply calibration formula
        metric_depth = self.scale_factor * normalized_depth + self.offset
        
        # Clamp to valid range
        metric_depth = np.clip(metric_depth, self.min_depth, self.max_depth)
        
        return metric_depth
        
    def calibrate_with_known_distance(self, normalized_depth_value, known_distance):
        """
        Calibrate using a known distance measurement.
        
        Args:
            normalized_depth_value: Normalized depth value from MiDaS
            known_distance: Actual measured distance in meters
        """
        # Update scale factor based on this measurement
        # Simple 1-point calibration (could be extended to multi-point)
        if normalized_depth_value > 0:
            self.scale_factor = (known_distance - self.offset) / normalized_depth_value
            print(f"Calibrated scale factor: {self.scale_factor}")
        
    def load_calibration(self, calibration_file):
        """
        Load calibration from file.
        
        Args:
            calibration_file: Path to calibration JSON file
        """
        try:
            with open(calibration_file, 'r') as f:
                calibration = json.load(f)
                
            self.scale_factor = calibration.get('scale_factor', self.scale_factor)
            self.offset = calibration.get('offset', self.offset)
            self.min_depth = calibration.get('min_depth', self.min_depth)
            self.max_depth = calibration.get('max_depth', self.max_depth)
            
            print(f"Loaded depth calibration: scale={self.scale_factor}, offset={self.offset}")
            
        except Exception as e:
            print(f"Error loading depth calibration: {e}")
            
    def save_calibration(self, calibration_file):
        """
        Save calibration to file.
        
        Args:
            calibration_file: Path to save calibration JSON file
        """
        calibration = {
            'scale_factor': self.scale_factor,
            'offset': self.offset,
            'min_depth': self.min_depth,
            'max_depth': self.max_depth
        }
        
        try:
            with open(calibration_file, 'w') as f:
                json.dump(calibration, f, indent=4)
                
            print(f"Saved depth calibration to {calibration_file}")
            
        except Exception as e:
            print(f"Error saving depth calibration: {e}")
            
    def visualize_depth(self, depth_map, original_frame=None):
        """
        Create a visualization of depth map with distance overlay.
        
        Args:
            depth_map: Metric depth map (in meters)
            original_frame: Optional original frame to overlay info
            
        Returns:
            visualization: Visualization image
        """
        # Normalize for visualization
        normalized = np.clip(depth_map / self.max_depth, 0, 1)
        
        # Apply colormap
        depth_colormap = cv2.applyColorMap(
            (normalized * 255).astype(np.uint8),
            cv2.COLORMAP_JET
        )
        
        if original_frame is not None:
            # Resize depth to match original frame
            if depth_colormap.shape[:2] != original_frame.shape[:2]:
                depth_colormap = cv2.resize(depth_colormap, 
                                           (original_frame.shape[1], original_frame.shape[0]))
                
            # Create alpha blend
            alpha = 0.4
            visualization = cv2.addWeighted(original_frame, 1 - alpha, depth_colormap, alpha, 0)
            
            # Add depth scale bar
            height, width = visualization.shape[:2]
            bar_width = 20
            bar_height = height // 2
            bar_x = width - bar_width - 10
            bar_y = (height - bar_height) // 2
            
            # Draw gradient bar
            for i in range(bar_height):
                depth_value = 1.0 - (i / bar_height)
                color = cv2.applyColorMap(
                    np.array([[int(depth_value * 255)]]).astype(np.uint8),
                    cv2.COLORMAP_JET
                )[0, 0]
                
                y = bar_y + i
                cv2.rectangle(visualization, 
                             (bar_x, y), 
                             (bar_x + bar_width, y + 1), 
                             color.tolist(), 
                             -1)
            
            # Add depth markers (min, middle, max)
            cv2.putText(visualization, f"{self.min_depth}m", 
                       (bar_x - 40, bar_y + bar_height), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                       
            cv2.putText(visualization, f"{self.max_depth}m", 
                       (bar_x - 40, bar_y), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                       
            mid_depth = (self.min_depth + self.max_depth) / 2
            cv2.putText(visualization, f"{mid_depth:.1f}m", 
                       (bar_x - 40, bar_y + bar_height // 2), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                       
            # Draw rectangle around the bar
            cv2.rectangle(visualization, 
                         (bar_x, bar_y), 
                         (bar_x + bar_width, bar_y + bar_height), 
                         (255, 255, 255), 
                         1)
        else:
            visualization = depth_colormap
            
        return visualization