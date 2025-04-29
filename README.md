# Spatial Detector

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python Versions](https://img.shields.io/badge/python-3.7%2B-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)

A Python package for 3D object detection and spatial mapping using a webcam, combining YOLO object detection with monocular depth estimation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Command Line Interface](#command-line-interface)
  - [Web Interface](#web-interface)
  - [Python API](#python-api)
  - [Controls](#controls)
- [Architecture](#architecture)
  - [Components](#components)
  - [Data Flow](#data-flow)
- [Calibration](#calibration)
- [API Reference](#api-reference)
- [Development](#development)
  - [Setting up a Development Environment](#setting-up-a-development-environment)
  - [Testing](#testing)
  - [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

Spatial Detector combines state-of-the-art object detection with monocular depth estimation to create a 3D representation of objects in your environment using only a standard webcam or iPhone camera. It provides a user-friendly web interface, a desktop command-line application, and a Python API for integration into your own applications.

The project uses YOLOv8 for object detection and MiDaS for depth estimation, with optimizations for both Apple Silicon (M1/M2) through Metal Performance Shaders and NVIDIA GPUs through CUDA.

## Features

### Core Capabilities
- **Real-time Object Detection**: Identify and classify objects using YOLOv8
- **Monocular Depth Estimation**: Calculate distances using neural network-based depth sensing
- **3D Spatial Mapping**: Project detected objects into 3D space
- **Real-time Visualization**: See depth maps and object positions interactively
- **Top-down View**: Get a bird's eye perspective of your environment

### User Interface Options
- **User-Friendly Web Interface**: Modern, responsive web app for easy use
- **iPhone Camera Support**: Stream directly from iPhone cameras
- **Interactive 3D Visualization**: Three.js-based 3D view with controls
- **Setup Wizard**: Guided setup process for new users
- **Desktop Application**: Traditional OpenCV-based UI

### Technical Features
- **Hardware Acceleration**: Optimized for:
  - Apple Silicon (M1/M2) chips using Metal Performance Shaders (MPS)
  - NVIDIA GPUs using CUDA
  - Fallback to CPU for compatibility
- **Depth Calibration**: Tools for accurate real-world measurements
- **Interactive Controls**: Toggle visualizations and adjust settings in real-time
- **Persistence and Tracking**: Follow objects as they move through your space
- **Spatial Mapping**: Create top-down views of your environment with detected objects
- **WebSocket/Socket.IO**: Real-time communication between client and server
- **QR Code Pairing**: Simple device connection for mobile devices

## Installation

### Prerequisites
- Python 3.7 or later
- [PyTorch](https://pytorch.org/get-started/locally/) 1.13 or later
- OpenCV 4.5 or later

### Option 1: Install from PyPI (Recommended)

```bash
# Install base package with standard pip
pip install spatial-detector

# Or use UV for faster installation
uv pip install spatial-detector

# Install with web UI support
pip install "spatial-detector[web]"
uv pip install "spatial-detector[web]"
```

### Option 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/oldhero5/spatial-detector.git
cd spatial-detector

# Install base package
pip install -e .
uv pip install -e .

# Install with web UI support
pip install -e ".[web]"
uv pip install -e ".[web]"

# Install with all development dependencies
pip install -e ".[dev,web]"
uv pip install -e ".[dev,web]"
```

## Quick Start

After installation, run one of the applications with default settings:

```bash
# Start desktop webcam application
spatial-detector

# Start web interface (including iPhone support)
spatial-detector-web
```

The desktop application will:
1. Access your default webcam
2. Load the lightweight YOLOv8n model
3. Initialize the MiDaS depth estimator
4. Show both the main detection view and a top-down spatial map

The web interface will:
1. Start a web server on http://localhost:5000
2. Provide a user-friendly interface accessible from any browser
3. Support iPhone camera streaming via QR code pairing
4. Offer enhanced 3D visualization with interactive controls

## Usage

### Command Line Interface

#### Desktop Application

The CLI provides a flexible interface for using Spatial Detector with various options:

```bash
# Basic usage with default webcam
spatial-detector

# Specify a different webcam (by index)
spatial-detector --camera 1

# Use a different YOLO model
spatial-detector --yolo-model yolov8s.pt

# Specify resolution
spatial-detector --width 1280 --height 720

# Force a specific compute device
spatial-detector --device cuda  # For NVIDIA GPU
spatial-detector --device mps   # For Apple Silicon
spatial-detector --device cpu   # Force CPU processing

# Record video output
spatial-detector --record output.mp4

# Load calibration files
spatial-detector --calibration camera_calibration.json --depth-calibration depth_calibration.json

# Customize room dimensions for mapping
spatial-detector --room-width 10.0 --room-depth 8.0
```

#### Web Interface

The web interface can be customized with these options:

```bash
# Start web server with default settings (localhost:5000)
spatial-detector-web

# Specify host and port
spatial-detector-web --host 0.0.0.0 --port 8080

# Enable debug mode for development
spatial-detector-web --debug

# Specify custom template and static file locations
spatial-detector-web --templates /path/to/templates --static /path/to/static
```

The web interface is accessible at `http://localhost:5011` by default (or the host:port you specify).

### Web Interface

The web-based user interface offers a more user-friendly way to use Spatial Detector:

#### Features

- **Setup Wizard**: Guided onboarding for new users
- **Device Selection**: Support for webcams and iPhone cameras
- **Real-time Visualization**: Live detection results with depth information
- **Interactive 3D Map**: Three.js-based spatial visualization
- **Project Management**: Save and load project states
- **Calibration Tools**: User-friendly calibration workflow
- **Mobile Responsiveness**: Works on desktop and mobile browsers

#### iPhone Integration

To use your iPhone as a camera source:

1. Start the web server with `spatial-detector-web`
2. Open the web interface in your browser
3. Click "Connect to iPhone" or select iPhone in the setup wizard
4. Scan the generated QR code with your iPhone camera
5. Follow the prompts on your iPhone to allow camera access
6. Start using your iPhone as a high-quality camera source

The iPhone integration uses web technologies for low-latency, high-quality video streaming.

#### 3D Visualization

The web interface includes an advanced 3D visualization system:

- **Interactive Controls**: Rotate, pan, and zoom the 3D view
- **Object Tracking**: Track detected objects in 3D space
- **Custom Rendering**: Configurable colors and visualization styles
- **Grid System**: Reference grid for scale and orientation
- **3D Export**: Export the spatial map for use in other applications

Full list of CLI options:

| Option | Description | Default |
|--------|-------------|---------|
| `--camera` | Camera index | 0 |
| `--yolo-model` | YOLO model path or name | yolov8n.pt |
| `--confidence` | Detection confidence threshold | 0.25 |
| `--device` | Computation device (mps, cuda, cpu, auto) | auto |
| `--calibration` | Camera calibration file | None |
| `--depth-calibration` | Depth calibration file | None |
| `--record` | Path to save video recording | None |
| `--width` | Camera width | 640 |
| `--height` | Camera height | 480 |
| `--room-width` | Room width in meters | 5.0 |
| `--room-depth` | Room depth in meters | 5.0 |

### Python API

For programmatic use, Spatial Detector can be integrated into your own Python applications:

```python
from spatial_detector.detection import YOLODetector
from spatial_detector.depth import MiDaSDepthEstimator
from spatial_detector.projection import PinholeCamera
from spatial_detector.visualization import Visualizer
from spatial_detector.mapping import SpatialMap, DepthCalibrator

import cv2
import numpy as np

# Initialize components
detector = YOLODetector(model_path="yolov8n.pt", confidence=0.25)
depth_estimator = MiDaSDepthEstimator()
camera = PinholeCamera()
visualizer = Visualizer(show_depth=True, show_labels=True)
spatial_map = SpatialMap(room_dimensions=(5.0, 5.0))
depth_calibrator = DepthCalibrator()

# Open webcam
cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    # Detect objects
    detections = detector.detect(frame)
    
    # Estimate depth
    depth_map, depth_norm = depth_estimator.estimate_depth(frame)
    
    # Convert to metric depth
    metric_depth_map = depth_calibrator.depth_to_meters(depth_norm)
    
    # Project to 3D space
    positions_3d = []
    for detection in detections:
        center_x, center_y = detection['center']
        normalized_depth = depth_estimator.get_depth_at_point(depth_norm, center_x, center_y)
        if normalized_depth is not None:
            metric_depth = depth_calibrator.depth_to_meters(normalized_depth)
            position_3d = camera.pixel_to_3d(center_x, center_y, metric_depth, normalized_depth=False)
            positions_3d.append(position_3d)
        else:
            positions_3d.append((0, 0, 0))
    
    # Update spatial map
    spatial_map.update(detections, positions_3d)
    
    # Visualize results
    annotated_frame = visualizer.draw_detections(frame, detections, positions_3d)
    map_viz = spatial_map.get_topdown_view(width=400, height=400)
    
    # Display
    cv2.imshow('Detection', annotated_frame)
    cv2.imshow('Map', map_viz)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

### Controls

#### Desktop Application Controls

When using the CLI application, the following keyboard controls are available:

| Key | Function |
|-----|----------|
| `q` | Quit application |
| `d` | Toggle depth visualization |
| `l` | Toggle object labels |
| `m` | Toggle map mode (topdown/3D) |
| `c` | Enter/exit calibration mode |
| `+`/`-` | Adjust calibration distance (in calibration mode) |
| `space` | Set calibration point (in calibration mode) |
| `s` | Save depth calibration |

#### Web Interface Controls

The web interface provides the following interactive controls:

**Camera Controls:**
- Start/Stop Camera: Toggle webcam capture
- Select Camera: Choose from available webcams
- Connect to iPhone: Generate QR code for iPhone connection

**Visualization Controls:**
- Show/Hide Labels: Toggle object labels
- Show/Hide Depth Map: Toggle depth visualization
- Show/Hide Grid: Toggle 3D grid

**Map Controls:**
- Show/Hide Map: Toggle 3D map view
- Reset View: Return to default camera position
- Export 3D Model: Export the spatial map (when available)

**Calibration Controls:**
- Start Calibration: Enter calibration mode
- Save Calibration: Save current calibration

**Project Controls:**
- New Project: Start a new spatial mapping project
- Save Project: Save current project state
- Load Project: Load a previously saved project

## Architecture

Spatial Detector follows a modular design with these core components:

### Components

1. **YOLODetector**: Handles 2D object detection using YOLOv8
   - Identifies objects in the scene
   - Provides bounding boxes, class labels, and confidence scores

2. **MiDaSDepthEstimator**: Provides monocular depth estimation
   - Generates a depth map from a single RGB image
   - Uses MiDaS deep learning model

3. **PinholeCamera**: Implements camera projection model
   - Converts 2D pixel coordinates to 3D space
   - Handles camera calibration

4. **DepthCalibrator**: Calibrates depth values to real-world measurements
   - Converts normalized depth to metric distances
   - Provides tools for distance calibration

5. **SpatialMap**: Creates and maintains a spatial representation
   - Tracks objects in 3D space
   - Provides top-down visualization

6. **Visualizer**: Handles visualization and UI elements
   - Draws bounding boxes and labels
   - Renders depth maps and other visualizations

7. **Web Interface**: Provides a user-friendly web-based UI
   - Supports iPhone camera streaming
   - Interactive 3D visualization with Three.js
   - Project management and calibration wizard

8. **CLI Application**: Ties everything together in an interactive interface

### Data Flow

#### Desktop Application Flow
1. Image acquisition from webcam
2. Parallel processing:
   - Object detection (YOLOv8)
   - Depth estimation (MiDaS)
3. Depth calibration and conversion to metrics
4. 3D projection of detected objects
5. Spatial mapping and object tracking
6. Visualization and user interaction

#### Web Interface Flow
1. Image acquisition from webcam or iPhone camera
2. Image streaming via WebSocket/WebRTC
3. Server-side processing:
   - Object detection (YOLOv8)
   - Depth estimation (MiDaS)
   - 3D projection and mapping
4. Real-time results pushed to client
5. Client-side 3D visualization with Three.js
6. Interactive controls and project management

## Calibration

For accurate real-world measurements, Spatial Detector includes a calibration workflow:

### Depth Calibration

1. Enter calibration mode by pressing `c`
2. Place an object at a known distance from the camera (e.g., 1 meter)
3. Use `+`/`-` keys to adjust the displayed distance to match the actual distance
4. Align the object with the center crosshair
5. Press `space` to set the calibration point
6. Press `s` to save the calibration to a file

Calibration is saved to `depth_calibration.json` by default or to the file specified with `--depth-calibration`.

### Camera Calibration (Advanced)

For even more accurate 3D positioning, you can provide a camera calibration file with intrinsic parameters:

1. Generate a calibration file using OpenCV's camera calibration tools
2. Save it as a JSON file with the following format:
   ```json
   {
       "fx": 1000.0,
       "fy": 1000.0,
       "cx": 640.0,
       "cy": 360.0
   }
   ```
3. Provide the file path using the `--calibration` option

## API Reference

### spatial_detector.detection

#### YOLODetector

```python
from spatial_detector.detection import YOLODetector

detector = YOLODetector(
    model_path='yolov8n.pt',  # Model name or path
    confidence=0.25,          # Detection threshold
    device=None               # Computation device (None for auto-detect)
)

# Detect objects in a frame
detections = detector.detect(frame)
```

Return format for `detect()`:
```python
[
    {
        'bbox': (x1, y1, x2, y2),  # Bounding box coordinates
        'center': (center_x, center_y),  # Center point
        'class_id': 0,  # Numeric class ID
        'class_name': 'person',  # Class name
        'confidence': 0.92  # Detection confidence
    },
    # Additional detections...
]
```

### spatial_detector.depth

#### MiDaSDepthEstimator

```python
from spatial_detector.depth import MiDaSDepthEstimator

depth_estimator = MiDaSDepthEstimator(
    model_type="MiDaS_small",  # Model type
    device=None                # Computation device
)

# Estimate depth from RGB image
depth_map, depth_norm = depth_estimator.estimate_depth(frame)

# Get depth at specific pixel
depth_value = depth_estimator.get_depth_at_point(depth_map, x, y)
```

### spatial_detector.projection

#### PinholeCamera

```python
from spatial_detector.projection import PinholeCamera

camera = PinholeCamera(
    focal_length=1000,         # Focal length in pixels
    principal_point=None,      # Principal point (defaults to image center)
    image_size=(1280, 720)     # Image dimensions
)

# Project pixel to 3D space
x, y, z = camera.pixel_to_3d(pixel_x, pixel_y, depth)

# Load camera calibration
camera.load_calibration("camera_calibration.json")
```

### spatial_detector.mapping

#### DepthCalibrator

```python
from spatial_detector.mapping import DepthCalibrator

calibrator = DepthCalibrator(calibration_file=None)

# Calibrate with known distance
calibrator.calibrate_with_known_distance(depth_value, real_distance)

# Convert normalized depth to meters
metric_depth = calibrator.depth_to_meters(normalized_depth)

# Save calibration
calibrator.save_calibration("depth_calibration.json")
```

#### SpatialMap

```python
from spatial_detector.mapping import SpatialMap

spatial_map = SpatialMap(room_dimensions=(5.0, 5.0))

# Update map with new detections
spatial_map.update(detections, positions_3d)

# Get visualization
map_visualization = spatial_map.get_topdown_view(width=400, height=400)
```

### spatial_detector.visualization

#### Visualizer

```python
from spatial_detector.visualization import Visualizer

visualizer = Visualizer(
    show_depth=True,     # Show depth visualization
    show_labels=True,    # Show labels and coordinates
    depth_map_size=0.25  # Size of depth map visualization
)

# Draw detections on frame
annotated_frame = visualizer.draw_detections(frame, detections, positions_3d)

# Add depth visualization
frame_with_depth = visualizer.add_depth_visualization(frame, depth_normalized)
```

## Development

### Setting up a Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/oldhero5/spatial-detector.git
   cd spatial-detector
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install development dependencies:
   ```bash
   uv pip install -e ".[dev]"
   # or
   pip install -e ".[dev]"
   ```

### Testing

Run tests with pytest:

```bash
pytest
```

Run tests with coverage:

```bash
pytest --cov=spatial_detector tests/
```

### Release Process

Spatial Detector uses semantic versioning and provides a version bumping script:

```bash
# Bump patch version (e.g., 0.1.0 -> 0.1.1)
python version_bump.py patch

# Bump minor version (e.g., 0.1.0 -> 0.2.0)
python version_bump.py minor

# Bump major version (e.g., 0.1.0 -> 1.0.0)
python version_bump.py major

# Edit release notes during version bump
python version_bump.py patch --notes
```

The script will:
1. Update version in pyproject.toml and __init__.py
2. Add a new section to CHANGELOG.md
3. Create RELEASE_NOTES.md with a template
4. Create a git tag for the new version

To complete the release:
```bash
git push && git push origin v0.1.1
```

This will trigger GitHub Actions to:
1. Build the package
2. Deploy to PyPI
3. Create a GitHub Release

For detailed release management instructions, see [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

## Troubleshooting

### Common Issues

#### Installation Problems

- **PyTorch installation fails**: Make sure you're installing the correct version for your system. Visit [PyTorch's installation page](https://pytorch.org/get-started/locally/) for system-specific instructions.

- **CUDA errors**: If using an NVIDIA GPU, ensure your CUDA drivers are up to date.

- **Web package installation fails**: If you see errors related to "pywebrtc not found", use `uv pip install -e ".[web]"` with our latest version which removes this dependency.

- **Missing modules**: If you encounter "ImportError: cannot import name 'SpatialMap'" or similar, ensure you're using the latest version which includes all required modules.

#### Runtime Issues

- **Low FPS**: Try using a smaller YOLO model (e.g., yolov8n.pt instead of yolov8m.pt) or reduce camera resolution.

- **"CUDA out of memory"**: Reduce batch size or switch to a smaller model.

- **Inaccurate depth**: Perform depth calibration for your specific camera and environment.

- **Camera not found**: Check your camera index (--camera option) and permissions.

### Performance Optimization

- For Apple Silicon: Make sure to use the MPS backend (--device mps)
- For NVIDIA GPUs: Ensure CUDA is properly installed (--device cuda)
- Use an appropriate YOLO model size for your hardware:
  - Low-end: yolov8n.pt
  - Mid-range: yolov8s.pt
  - High-end: yolov8m.pt or yolov8l.pt

## License

Spatial Detector is released under the MIT License. See [LICENSE](LICENSE) for details.

---

Copyright © 2025 Your Name. All rights reserved.