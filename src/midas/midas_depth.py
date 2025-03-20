import torch
import cv2
import numpy as np

class MiDaSDepthEstimator:
    """
    MiDaS-based monocular depth estimation.
    """
    def __init__(self, model_type="MiDaS_small", device=None):
        """
        Initialize the MiDaS depth estimator.
        
        Args:
            model_type: MiDaS model type ("MiDaS_small", "DPT_Large", or "DPT_Hybrid")
            device: Computation device ('cuda', 'cpu', or None for auto-detection)
        """
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load MiDaS model
        print(f"Loading MiDaS model: {model_type} on {self.device}")
        self.model = torch.hub.load("intel-isl/MiDaS", model_type)
        self.model.to(self.device)
        self.model.eval()
        
        # MiDaS transformation
        self.midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        
        if model_type == "DPT_Large" or model_type == "DPT_Hybrid":
            self.transform = self.midas_transforms.dpt_transform
        else:
            self.transform = self.midas_transforms.small_transform
            
    def estimate_depth(self, frame):
        """
        Estimate depth from RGB image.
        
        Args:
            frame: RGB image as numpy array
            
        Returns:
            depth_map: Raw depth map as numpy array
            depth_normalized: Normalized depth map (0-1) for visualization
        """
        # Transform input for MiDaS
        input_batch = self.transform(frame).to(self.device)
        
        # Run inference
        with torch.no_grad():
            prediction = self.model(input_batch)
            
            # Resize to original resolution
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=frame.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()
            
        depth_map = prediction.cpu().numpy()
        
        # Normalize depth map for visualization
        depth_norm = cv2.normalize(depth_map, None, 0, 1, norm_type=cv2.NORM_MINMAX)
        
        return depth_map, depth_norm
    
    def get_depth_at_point(self, depth_map, x, y):
        """
        Get depth value at specific point.
        
        Args:
            depth_map: Depth map from estimate_depth()
            x, y: Coordinates
            
        Returns:
            depth_value: Depth value at point (x,y)
        """
        if 0 <= y < depth_map.shape[0] and 0 <= x < depth_map.shape[1]:
            return depth_map[y, x]
        else:
            return None