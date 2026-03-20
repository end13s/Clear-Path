import cv2
import numpy as np

# YOLOv8 default input size
TARGET_SIZE = (640, 640)


def preprocess(frame: np.ndarray) -> np.ndarray:
    """Resize and normalize a BGR frame for YOLO inference."""
    resized = cv2.resize(frame, TARGET_SIZE)
    return resized
