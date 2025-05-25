from functools import lru_cache

import cv2
import numpy as np
import torch

# Model cache for improved performance
_DEPTH_MODEL_CACHE = {}
_TRANSFORM_CACHE = {}


# Cache the model loading to improve performance
def _get_cached_midas_model(model_type, device):
    """Get a MiDaS model from cache or load a new one"""
    cache_key = f"{model_type}_{device}"

    if cache_key in _DEPTH_MODEL_CACHE:
        print(f"Using cached MiDaS model: {model_type}")
        return _DEPTH_MODEL_CACHE[cache_key]

    # Load a new model
    model = torch.hub.load("intel-isl/MiDaS", model_type)
    model.to(device)
    model.eval()

    # Cache the model
    _DEPTH_MODEL_CACHE[cache_key] = model
    return model


# Cache the transforms for improved loading performance
def _get_midas_transforms():
    """Get MiDaS transforms from cache or load new ones"""
    if not _TRANSFORM_CACHE:
        _TRANSFORM_CACHE["transforms"] = torch.hub.load("intel-isl/MiDaS", "transforms")
    return _TRANSFORM_CACHE["transforms"]


class MiDaSDepthEstimator:
    """
    MiDaS-based monocular depth estimation.
    Optimized with model caching for better performance.
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
                self.device = "mps"  # Apple Silicon GPU
            elif torch.cuda.is_available():
                self.device = "cuda"  # NVIDIA GPU
            else:
                self.device = "cpu"
        else:
            self.device = device

        # Load MiDaS model with error handling and caching
        try:
            self._report_progress("Initializing MiDaS depth estimator...")
            print(f"Loading MiDaS model: {model_type} on {self.device}")
            self._report_progress(f"Loading MiDaS model: {model_type} on {self.device}")

            # Load model with error handling and caching
            try:
                self.model = _get_cached_midas_model(model_type, self.device)
                print(f"Successfully loaded MiDaS model: {model_type}")
            except Exception as model_err:
                error_msg = f"Error loading MiDaS model {model_type}: {model_err}"
                print(error_msg)
                self._report_progress(error_msg)
                # Try fallback to small model if a different one was requested
                if model_type != "MiDaS_small":
                    print("Trying fallback model: MiDaS_small")
                    self._report_progress("Trying fallback model: MiDaS_small")
                    self.model = _get_cached_midas_model("MiDaS_small", self.device)
                    model_type = (
                        "MiDaS_small"  # Update model type for transform selection
                    )
                else:
                    raise RuntimeError(error_msg)

            # MiDaS transformation with error handling and caching
            try:
                self._report_progress("Loading transformations...")
                self.midas_transforms = _get_midas_transforms()

                if model_type == "DPT_Large" or model_type == "DPT_Hybrid":
                    self.transform = self.midas_transforms.dpt_transform
                else:
                    self.transform = self.midas_transforms.small_transform
                print("Successfully loaded MiDaS transformations")
            except Exception as transform_err:
                error_msg = f"Error loading MiDaS transformations: {transform_err}"
                print(error_msg)
                self._report_progress(error_msg)
                raise RuntimeError(error_msg)

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
