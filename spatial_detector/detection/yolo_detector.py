import torch
from ultralytics import YOLO

class YOLODetector:
    """
    YOLO-based object detector for 2D object detection.
    """
    def __init__(self, model_path='yolov8n.pt', confidence=0.25, device=None):
        """
        Initialize the YOLO detector.
        
        Args:
            model_path: Path to YOLO model or model name
            confidence: Confidence threshold for detections
            device: Computation device ('cuda', 'mps', 'cpu', or None for auto-detection)
        """
        self.confidence = confidence
        
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
        
        # Load YOLO model
        print(f"Loading YOLO model: {model_path} on {self.device}")
        self.model = YOLO(model_path)
        
    def detect(self, frame):
        """
        Detect objects in a frame.
        
        Args:
            frame: RGB image as numpy array
            
        Returns:
            List of dictionaries with detection information
            Each dictionary contains: 'bbox', 'class_id', 'class_name', 'confidence'
        """
        results = self.model(frame, conf=self.confidence)
        
        detections = []
        for result in results:
            boxes = result.boxes
            for i, box in enumerate(boxes):
                # Get bounding box
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                
                # Get class and confidence
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.model.names[cls_id]
                
                # Calculate center point
                center_x = (x1 + x2) // 2
                center_y = (y1 + y2) // 2
                
                detection = {
                    'bbox': (x1, y1, x2, y2),
                    'center': (center_x, center_y),
                    'class_id': cls_id,
                    'class_name': cls_name,
                    'confidence': conf
                }
                
                detections.append(detection)
                
        return detections