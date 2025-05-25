"""
Depth calibration module for converting normalized depth to metric distances.
"""

import json
import os
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np


class DepthCalibrator:
    """
    Calibrates depth values to real-world measurements.
    """

    def __init__(self, calibration_file: Optional[str] = None):
        """
        Initialize the depth calibrator.

        Args:
            calibration_file: Path to a JSON calibration file (optional)
        """
        # Default calibration values
        self.depth_scale = 1.0
        self.depth_offset = 0.0

        # Load calibration if provided
        if calibration_file and os.path.exists(calibration_file):
            self.load_calibration(calibration_file)

    def calibrate_with_known_distance(
        self, normalized_depth: float, real_distance: float
    ):
        """
        Calibrate using a known distance.

        Args:
            normalized_depth: Normalized depth value from the depth estimator
            real_distance: Real-world distance in meters
        """
        # Simple linear mapping from normalized to metric
        # real_distance = normalized_depth * scale + offset

        # For a single point, we assume offset = 0 and calculate scale
        self.depth_scale = real_distance / normalized_depth
        self.depth_offset = 0.0

    def depth_to_meters(self, normalized_depth: np.ndarray) -> np.ndarray:
        """
        Convert normalized depth to metric distance in meters.

        Args:
            normalized_depth: Normalized depth from the depth estimator

        Returns:
            Depth in meters
        """
        if isinstance(normalized_depth, (float, int)):
            return normalized_depth * self.depth_scale + self.depth_offset
        else:
            return normalized_depth * self.depth_scale + self.depth_offset

    def save_calibration(self, file_path: str):
        """
        Save calibration parameters to a JSON file.

        Args:
            file_path: Path to save the calibration file
        """
        calibration_data = {
            "depth_scale": float(self.depth_scale),
            "depth_offset": float(self.depth_offset),
        }

        with open(file_path, "w") as f:
            json.dump(calibration_data, f, indent=4)
            print(f"Calibration saved to {file_path}")

    def load_calibration(self, file_path: str):
        """
        Load calibration parameters from a JSON file.

        Args:
            file_path: Path to the calibration file
        """
        try:
            with open(file_path, "r") as f:
                calibration_data = json.load(f)

            self.depth_scale = calibration_data.get("depth_scale", 1.0)
            self.depth_offset = calibration_data.get("depth_offset", 0.0)
            print(
                f"Loaded calibration: scale={self.depth_scale}, offset={self.depth_offset}"
            )

        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error loading calibration: {e}")
            # Use default values
            self.depth_scale = 1.0
            self.depth_offset = 0.0

    def visualize_depth(
        self,
        depth_map: np.ndarray,
        overlay_image: Optional[np.ndarray] = None,
        alpha: float = 0.7,
    ) -> np.ndarray:
        """
        Create a colored visualization of the depth map.

        Args:
            depth_map: Depth map to visualize
            overlay_image: Optional image to overlay depth on
            alpha: Transparency value for overlay

        Returns:
            Colorized depth map or overlay
        """
        # Normalize for visualization
        depth_min = np.min(depth_map)
        depth_max = np.max(depth_map)
        if depth_max > depth_min:
            depth_norm = (depth_map - depth_min) / (depth_max - depth_min)
        else:
            depth_norm = depth_map

        # Convert to uint8 for colormap
        depth_uint8 = (depth_norm * 255).astype(np.uint8)

        # Apply colormap (TURBO is good for depth visualization)
        if hasattr(cv2, "COLORMAP_TURBO"):  # OpenCV 4.5.1+
            depth_colormap = cv2.applyColorMap(depth_uint8, cv2.COLORMAP_TURBO)
        else:
            # Fallback to JET colormap for older OpenCV versions
            depth_colormap = cv2.applyColorMap(depth_uint8, cv2.COLORMAP_JET)

        if overlay_image is not None:
            # Resize if needed
            if depth_colormap.shape[:2] != overlay_image.shape[:2]:
                depth_colormap = cv2.resize(
                    depth_colormap, (overlay_image.shape[1], overlay_image.shape[0])
                )

            # Blend images
            return cv2.addWeighted(overlay_image, 1.0 - alpha, depth_colormap, alpha, 0)
        else:
            return depth_colormap
