import numpy as np

class PinholeCamera:
    """
    Pinhole camera model for 3D projection.
    """
    def __init__(self, focal_length=1000, principal_point=None, image_size=(1280, 720)):
        """
        Initialize the camera model with intrinsic parameters.
        
        Args:
            focal_length: Focal length in pixels (can be a tuple (fx, fy) or a single value)
            principal_point: Principal point (cx, cy), defaults to image center
            image_size: Image size (width, height)
        """
        self.image_width, self.image_height = image_size
        
        # Set principal point to image center if not provided
        if principal_point is None:
            self.cx = self.image_width / 2
            self.cy = self.image_height / 2
        else:
            self.cx, self.cy = principal_point
            
        # Set focal length
        if isinstance(focal_length, tuple):
            self.fx, self.fy = focal_length
        else:
            self.fx = self.fy = focal_length
            
    def pixel_to_3d(self, x, y, depth, normalized_depth=True, depth_scale=10.0):
        """
        Project pixel coordinates to 3D world coordinates.
        
        Args:
            x, y: Pixel coordinates
            depth: Depth value at pixel
            normalized_depth: Whether depth is normalized (0-1)
            depth_scale: Scaling factor for normalized depth
            
        Returns:
            X, Y, Z: 3D coordinates in world space
        """
        # Convert normalized depth to metric depth if needed
        if normalized_depth:
            Z = depth * depth_scale
        else:
            Z = depth
            
        # Apply pinhole camera model
        X = (x - self.cx) * Z / self.fx
        Y = (y - self.cy) * Z / self.fy
        
        return X, Y, Z
        
    def load_calibration(self, calibration_file):
        """
        Load camera calibration from file.
        
        Args:
            calibration_file: Path to calibration file
        """
        try:
            # This is a simplified example. In practice, you would load
            # camera matrix from calibration file (e.g., using OpenCV's calibration)
            import json
            with open(calibration_file, 'r') as f:
                calibration = json.load(f)
                
            self.fx = calibration.get('fx', self.fx)
            self.fy = calibration.get('fy', self.fy)
            self.cx = calibration.get('cx', self.cx)
            self.cy = calibration.get('cy', self.cy)
            
            print(f"Loaded camera calibration: fx={self.fx}, fy={self.fy}, cx={self.cx}, cy={self.cy}")
            
        except Exception as e:
            print(f"Error loading calibration: {e}")