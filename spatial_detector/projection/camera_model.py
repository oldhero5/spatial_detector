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

    def pixel_to_3d(self, x, y, depth, normalized_depth=True, depth_scale=5.0):
        """
        Project pixel coordinates to 3D world coordinates.

        Args:
            x, y: Pixel coordinates
            depth: Depth value at pixel
            normalized_depth: Whether depth is normalized (0-1)
            depth_scale: Scaling factor for normalized depth
                         Default reduced to 5.0 for more realistic scaling

        Returns:
            X, Y, Z: 3D coordinates in world space, or None if depth is invalid
        """
        # Convert inputs to proper data types
        try:
            x = float(x)
            y = float(y)
            depth = float(depth)
        except (TypeError, ValueError) as e:
            print(
                f"Error converting input types in pixel_to_3d: {e}, x={x}, y={y}, depth={depth}"
            )
            return None

        # Validate depth input
        if depth is None or np.isnan(depth) or np.isinf(depth) or depth <= 0:
            print(f"Invalid depth value: {depth}")
            return None

        try:
            # Convert normalized depth to metric depth if needed
            if normalized_depth:
                # Ensure depth is within expected range for normalized depth
                if depth < 0 or depth > 1:
                    print(f"Normalized depth out of range [0,1]: {depth}")
                    depth = max(0, min(depth, 1))  # Clamp to valid range

                Z = float(depth) * depth_scale
            else:
                Z = float(depth)

            # Ensure Z is positive and not too large (sanity check)
            if Z <= 0:
                print(f"Calculated Z value is not positive: {Z}")
                return None
            elif Z > 1000:  # Assume max depth of 1000m
                print(f"Calculated Z value exceeds maximum expected depth: {Z}")
                Z = 1000  # Clamp to maximum

            # Apply pinhole camera model
            X = float(x - self.cx) * Z / self.fx
            Y = float(y - self.cy) * Z / self.fy

            # Final validation of the calculated coordinates
            if any(np.isnan([X, Y, Z])) or any(np.isinf([X, Y, Z])):
                print(f"Invalid calculated 3D coordinates: X={X}, Y={Y}, Z={Z}")
                return None

            # Create and validate the coordinate tuple
            coordinates = (float(X), float(Y), float(Z))

            # Extra validation before returning
            if len(coordinates) != 3 or not all(
                isinstance(c, float) for c in coordinates
            ):
                print(
                    f"Warning: Created invalid coordinates: {coordinates}, setting to zeros"
                )
                return (0.0, 0.0, 0.0)

            return coordinates

        except (TypeError, ValueError) as e:
            print(f"Error in pixel_to_3d calculation: {e}, depth={depth}")
            return None

    def load_calibration(self, calibration_file):
        """
        Load camera calibration from file.

        Args:
            calibration_file: Path to calibration file
        """
        try:
            # Check if file exists
            import os

            if not os.path.exists(calibration_file):
                print(f"Calibration file not found: {calibration_file}")
                return False

            # Load calibration data
            import json

            with open(calibration_file, "r") as f:
                calibration = json.load(f)

            # Validate values before applying them
            if (
                "fx" in calibration
                and isinstance(calibration["fx"], (int, float))
                and calibration["fx"] > 0
            ):
                self.fx = float(calibration["fx"])
            else:
                print(f"Invalid fx value in calibration: {calibration.get('fx')}")

            if (
                "fy" in calibration
                and isinstance(calibration["fy"], (int, float))
                and calibration["fy"] > 0
            ):
                self.fy = float(calibration["fy"])
            else:
                print(f"Invalid fy value in calibration: {calibration.get('fy')}")

            if "cx" in calibration and isinstance(calibration["cx"], (int, float)):
                self.cx = float(calibration["cx"])
            else:
                print(f"Invalid cx value in calibration: {calibration.get('cx')}")

            if "cy" in calibration and isinstance(calibration["cy"], (int, float)):
                self.cy = float(calibration["cy"])
            else:
                print(f"Invalid cy value in calibration: {calibration.get('cy')}")

            # Optional depth scale parameter
            if (
                "depth_scale" in calibration
                and isinstance(calibration["depth_scale"], (int, float))
                and calibration["depth_scale"] > 0
            ):
                self.depth_scale = float(calibration["depth_scale"])
                print(f"Using custom depth scale from calibration: {self.depth_scale}")

            print(
                f"Loaded camera calibration: fx={self.fx}, fy={self.fy}, cx={self.cx}, cy={self.cy}"
            )
            return True

        except json.JSONDecodeError as json_err:
            print(f"Invalid JSON in calibration file: {json_err}")
            return False
        except Exception as e:
            print(f"Error loading calibration: {e}")
            return False

    def save_calibration(self, calibration_file):
        """
        Save camera calibration to file.

        Args:
            calibration_file: Path to save calibration file
        """
        try:
            import json

            calibration = {
                "fx": float(self.fx),
                "fy": float(self.fy),
                "cx": float(self.cx),
                "cy": float(self.cy),
                "image_width": float(self.image_width),
                "image_height": float(self.image_height),
            }

            # Ensure the directory exists
            import os

            os.makedirs(os.path.dirname(calibration_file), exist_ok=True)

            # Write calibration data
            with open(calibration_file, "w") as f:
                json.dump(calibration, f, indent=4)

            print(f"Saved camera calibration to {calibration_file}")
            return True

        except Exception as e:
            print(f"Error saving calibration: {e}")
            return False
