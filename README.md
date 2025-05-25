# Spatial Detector

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python Versions](https://img.shields.io/badge/python-3.7%2B-blue)
![Version](https://img.shields.io/badge/version-0.1.1-green)

A Python package for 3D object detection and spatial mapping using a webcam, combining YOLO object detection with monocular depth estimation.

<div align="center">
  <img src="docs/screenshots/spatial_detector_demo.png" alt="Spatial Detector Demo" width="80%">
  <p><em>Spatial Detector in action: 2D object detection with 3D mapping visualization</em></p>
</div>

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

### Recent Updates (v0.1.1)
- **Improved Performance**: Refactored web application for better performance and stability
- **Enhanced UI**: Modularized JavaScript code for improved maintainability
- **Fixed Socket.IO Issues**: Stabilized WebSocket connections and error handling
- **Better Bounding Box Rendering**: Fixed rendering issues and improved visual quality
- **3D Map Display Improvements**: Enhanced 3D visualization with better object tracking
- **Error Handling**: Added comprehensive error handling for depth estimation

## Installation

### Prerequisites
- Python 3.7 or later
- [PyTorch](https://pytorch.org/get-started/locally/) 1.13 or later
- OpenCV 4.5 or later

<div align="center">
  <img src="docs/screenshots/prerequisites.png" alt="Prerequisites" width="70%">
  <p><em>Development environment setup with required dependencies</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/installation.png" alt="Installation" width="70%">
  <p><em>Successful installation with all dependencies loaded</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/desktop_app.png" alt="Desktop Application" width="70%">
  <p><em>Desktop application showing 2D detection with depth visualization</em></p>
</div>

The web interface will:
1. Start a web server on http://localhost:5011
2. Provide a user-friendly interface accessible from any browser
3. Support iPhone camera streaming via QR code pairing
4. Offer enhanced 3D visualization with interactive controls

<div align="center">
  <img src="docs/screenshots/web_interface.png" alt="Web Interface" width="70%">
  <p><em>Web interface showing detection and 3D mapping with interactive controls</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/web_ui_components.png" alt="Web UI Components" width="70%">
  <p><em>Web UI components showing control panel, visualization area, and 3D map</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/iphone_integration.png" alt="iPhone Integration" width="70%">
  <p><em>iPhone camera streaming via QR code pairing process</em></p>
</div>

The iPhone integration uses web technologies for low-latency, high-quality video streaming.

#### 3D Visualization

The web interface includes an advanced 3D visualization system:

<div align="center">
  <img src="docs/screenshots/3d_visualization.png" alt="3D Visualization" width="70%">
  <p><em>3D visualization showing detected objects in a spatial environment</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/calibration_mode.png" alt="Calibration Mode" width="70%">
  <p><em>Calibration interface showing distance adjustment and crosshair alignment</em></p>
</div>

### Depth Calibration

1. Enter calibration mode by pressing `c` or clicking the "Start Calibration" button in the web interface
2. Place an object at a known distance from the camera (e.g., 1 meter)
3. Use `+`/`-` keys to adjust the displayed distance to match the actual distance
4. Align the object with the center crosshair
5. Press `space` to set the calibration point
6. Press `s` or click "Save Calibration" to save the calibration to a file

Calibration is saved to `depth_calibration.json` by default or to the file specified with `--depth-calibration`.

<div align="center">
  <img src="docs/screenshots/depth_calibration.png" alt="Depth Calibration Results" width="70%">
  <p><em>Depth calibration results showing improved distance measurements</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/camera_calibration.png" alt="Camera Calibration" width="70%">
  <p><em>Advanced camera calibration with intrinsic parameters visualization</em></p>
</div>

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

<div align="center">
  <img src="docs/screenshots/troubleshooting.png" alt="Troubleshooting" width="70%">
  <p><em>Troubleshooting interface showing error messages and diagnostics</em></p>
</div>

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

- **"NoneType object has no attribute pixel_to_3d"**: This error occurs when the camera model is not initialized properly. Restart the application or switch to a different camera source.

- **No objects appear in 3D map**: Ensure depth values are valid and make sure the objects are within the detection range. Try calibrating your depth sensor for better accuracy.

- **WebSocket errors**: If you see WebSocket connection issues in the browser console, check for network firewall settings or try a different browser. The latest version includes improved error handling for Socket.IO connections.

- **Bounding boxes not showing**: This could be due to CSS rendering issues. Try refreshing the page or adjusting the browser zoom level. Recent updates have improved bounding box rendering stability.

- **Detection processor errors**: If you see "Cannot read properties of undefined" errors, this has been fixed in v0.1.1 with better null checking and error handling.

- **3D map not updating**: Ensure position_3d values are valid (not None, NaN, or (0,0,0)). The latest version includes better validation for 3D positions.

### Performance Optimization

<div align="center">
  <img src="docs/screenshots/performance_optimization.png" alt="Performance Optimization" width="70%">
  <p><em>Performance monitoring dashboard showing optimization opportunities</em></p>
</div>

- **Model caching**: The latest version includes model caching to improve startup time and reduce memory usage for repeated initializations.

- **For Apple Silicon**: Make sure to use the MPS backend (--device mps)

- **For NVIDIA GPUs**: Ensure CUDA is properly installed (--device cuda)

- **Use an appropriate YOLO model size for your hardware**:
  - Low-end: yolov8n.pt
  - Mid-range: yolov8s.pt
  - High-end: yolov8m.pt or yolov8l.pt
  
- **Reduce processing resolution**: Lower the camera resolution for faster processing: `--width 640 --height 480`

- **WebSocket optimization**: The latest version includes optimized WebSocket communication to reduce latency and improve real-time performance.

- **JavaScript Performance**: v0.1.1 includes modularized JavaScript code that improves browser performance and reduces memory usage in the web interface.

- **Connection Stability**: Improved connection manager handles reconnections more gracefully, reducing dropped frames and improving overall stability.

## License

Spatial Detector is released under the MIT License. See [LICENSE](LICENSE) for details.

---

Copyright © 2025 Your Name. All rights reserved.