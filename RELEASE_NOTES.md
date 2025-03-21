# Release Notes - Spatial Detector v0.1.0

We're excited to announce the first release of Spatial Detector, a Python package for 3D object detection and spatial mapping using a webcam!

## 🌟 Highlights

- **Object Detection**: Identify objects in real-time using YOLOv8
- **Depth Estimation**: Calculate accurate distances using monocular depth sensing
- **Spatial Mapping**: Create top-down maps of your environment
- **Apple Silicon Support**: Optimized for M1/M2 Macs using Metal Performance Shaders
- **Interactive Visualization**: See depth maps and object positions in real-time

## 🛠️ Features

### Core Capabilities
- Real-time object detection and classification
- Monocular depth estimation without specialized hardware
- 3D localization of detected objects
- Persistence and tracking of objects across frames
- Top-down spatial mapping visualization

### Usability
- Simple command-line interface
- Interactive calibration for accurate measurements
- Visualization controls (toggle depth, labels, etc.)
- Video recording capabilities
- Real-time FPS counter

### Technical
- Optimized for Apple Silicon and NVIDIA GPUs
- UV package manager integration
- Modern Python packaging with pyproject.toml
- GitHub Actions for CI/CD

## 📋 Installation & Usage

### Installation
```bash
uv pip install spatial-detector
```

### Basic Usage
```bash
spatial-detector
```

### With Options
```bash
spatial-detector --device mps --yolo-model yolov8s.pt --width 1280 --height 720
```

## 🔍 Controls
- `q`: Quit
- `d`: Toggle depth visualization
- `l`: Toggle labels
- `c`: Enter calibration mode
- `+`/`-`: Adjust calibration distance
- `space`: Set calibration point
- `s`: Save depth calibration

## 🔮 What's Next

In upcoming releases, we plan to add:
- Multi-camera support
- 3D mesh generation
- SLAM (Simultaneous Localization And Mapping)
- Object segmentation
- More advanced tracking algorithms
- Mobile device support

We welcome contributions and feedback!