# Spatial Detector

A Python package for 3D object detection and spatial mapping using a webcam.

## Features

- YOLO-based object detection
- MiDaS depth estimation
- 3D spatial mapping and localization
- Top-down view visualization
- Depth calibration for accurate measurements
- Designed for Apple Silicon and CUDA GPUs

## Installation

```bash
pip install spatial-detector
```

Or install from source:

```bash
git clone https://github.com/yourusername/spatial-detector.git
cd spatial-detector
pip install -e .
```

## Usage

### Command Line Interface

```bash
# Basic usage
spatial-detector

# With custom settings
spatial-detector --camera 0 --yolo-model yolov8n.pt --device mps
```

### As a Python Library

```python
from spatial_detector.detection import YOLODetector
from spatial_detector.depth import MiDaSDepthEstimator
from spatial_detector.mapping import SpatialMap, DepthCalibrator

# Initialize components
detector = YOLODetector(model_path="yolov8n.pt")
depth_estimator = MiDaSDepthEstimator()
spatial_map = SpatialMap()

# Process a frame
detections = detector.detect(frame)
depth_map, _ = depth_estimator.estimate_depth(frame)
```

## Controls

- `q`: Quit
- `d`: Toggle depth visualization
- `l`: Toggle labels
- `c`: Enter calibration mode
- `+`/`-`: Adjust calibration distance
- `space`: Set calibration point in calibration mode
- `s`: Save depth calibration

## Calibration

For accurate measurements:

1. Press `c` to enter calibration mode
2. Place an object at a known distance (e.g., 1 meter from camera)
3. Use `+`/`-` to set the correct distance
4. Align the object with the center crosshair
5. Press `space` to calibrate
6. Press `s` to save the calibration

## License

MIT