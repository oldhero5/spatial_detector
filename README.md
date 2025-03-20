# 3D Object Detection Pipeline

This project provides a pipeline for detecting and localizing objects in 3D space using monocular video input. The pipeline combines YOLO object detection with MiDaS depth estimation to achieve 3D localization.

## Features

- 2D object detection using YOLOv8
- Monocular depth estimation using MiDaS
- 3D projection using pinhole camera model
- Real-time processing for webcam input
- Batch processing for video files
- Camera calibration support

## Installation

### Using uv package manager

```bash
# Install uv if not already installed
curl -sSf https://install.ultraviolet.rs | sh

# Create and activate virtual environment
uv venv 3d_detection_env
source 3d_detection_env/bin/activate  # On Linux/macOS
# OR
3d_detection_env\Scripts\activate  # On Windows

# Install dependencies
uv pip install -r requirements.txt