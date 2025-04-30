import torch
import cv2
import numpy as np

class MiDaSDepthEstimator:
    """
    MiDaS-based monocular depth estimation.
    """
    def __init__(self, model_type="MiDaS_small", device=None, progress_callback=None):
        """
        Initialize the MiDaS depth estimator.
        
        Args:
            model_type: MiDaS model type ("MiDaS_small", "DPT_Large", or "DPT_Hybrid")
            device: Computation device ('cuda', 'cpu', or None for auto-detection)
            progress_callback: Optional callback function to report loading progress
        """
        self.model_type = model_type
        self.progress_callback = progress_callback
        self.model = None
        self.transform = None
        self.midas_transforms = None
        
        # Auto-detect the best available device
        if device is None:
            if torch.backends.mps.is_available():
                self.device = 'mps'  # Apple Silicon GPU
            elif torch.cuda.is_available():
                self.device = 'cuda'  # NVIDIA GPU
            else:
                self.device = 'cpu'
        else:
            self.device = device
        
        # Load MiDaS model with error handling
        try:
            self._report_progress("Initializing MiDaS depth estimator...")
            print(f"Loading MiDaS model: {model_type} on {self.device}")
            self._report_progress(f"Loading MiDaS model: {model_type} on {self.device}")
            
            # Load model
            self.model = torch.hub.load("intel-isl/MiDaS", model_type)
            self.model.to(self.device)
            self.model.eval()
            
            # MiDaS transformation
            self._report_progress("Loading transformations...")
            self.midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
            
            if model_type == "DPT_Large" or model_type == "DPT_Hybrid":
                self.transform = self.midas_transforms.dpt_transform
            else:
                self.transform = self.midas_transforms.small_transform
                
            self._report_progress("MiDaS depth estimator loaded successfully")
            
        except Exception as e:
            error_msg = f"Error loading MiDaS model: {e}"
            print(error_msg)
            self._report_progress(error_msg)
            raise RuntimeError(error_msg)
            
    def _report_progress(self, message):
        """Report progress through callback if available"""
        if self.progress_callback:
            self.progress_callback("depth", message)
            
    def estimate_depth(self, frame):
        """
        Estimate depth from RGB image.
        
        Args:
            frame: RGB image as numpy array
            
        Returns:
            depth_map: Raw depth map as numpy array
            depth_normalized: Normalized depth map (0-1) for visualization
        """
        if self.model is None or self.transform is None:
            print("Error: MiDaS model not fully initialized")
            # Return dummy depth maps of correct shape
            h, w = frame.shape[:2]
            dummy_depth = np.zeros((h, w), dtype=np.float32)
            return dummy_depth, dummy_depth
            
        try:
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
            
        except Exception as e:
            print(f"Error during depth estimation: {e}")
            self._report_progress(f"Depth estimation error: {e}")
            # Return dummy depth maps of correct shape
            h, w = frame.shape[:2]
            dummy_depth = np.zeros((h, w), dtype=np.float32)
            return dummy_depth, dummy_depth
    
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