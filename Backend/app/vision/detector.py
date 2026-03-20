import numpy as np
from ultralytics import YOLO

from app.core.schemas import Detection
from app.vision.preprocessor import TARGET_SIZE, preprocess
from app.vision.postprocessor import build_detections


class Detector:
    def __init__(self, model_path: str, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        self.model = YOLO(model_path)

    def detect(self, frame: np.ndarray) -> list[Detection]:
        orig_h, orig_w = frame.shape[:2]
        preprocessed = preprocess(frame)

        scale_x = orig_w / TARGET_SIZE[0]
        scale_y = orig_h / TARGET_SIZE[1]

        results = self.model(preprocessed, conf=self.confidence_threshold, verbose=False)
        return build_detections(results, orig_w, orig_h, scale_x, scale_y)


# Quick local test — run with: python -m app.vision.detector
if __name__ == "__main__":
    import cv2
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "test.jpg"
    frame = cv2.imread(path)
    if frame is None:
        print(f"Could not read {path}")
        sys.exit(1)

    detector = Detector(model_path="app/models/yolov8_traffic.pt")
    detections = detector.detect(frame)
    for d in detections:
        print(d)
