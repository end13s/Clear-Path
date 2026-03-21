import numpy as np
from collections import deque
from ultralytics import YOLO

from app.core.schemas import Detection
from app.vision.preprocessor import TARGET_SIZE, preprocess
from app.vision.postprocessor import build_detections, filter_detections

_LIGHT_LABELS = {"green_light", "yellow_light", "red_light", "traffic_light"}
_HOLD_FRAMES = 5        # hold last confirmed light for up to this many consecutive misses
_COLOR_SWITCH_FRAMES = 4  # consecutive frames of a new color needed to displace confirmed color


class Detector:
    def __init__(self, model_path: str, confidence_threshold: float = 0.65):
        self.confidence_threshold = confidence_threshold
        self.model = YOLO(model_path)
        self._held_lights: list[Detection] = []
        self._miss_streak: int = 0
        # Color stability state
        self._confirmed_color: str | None = None   # locked-in color label
        self._challenger_color: str | None = None  # color trying to displace confirmed
        self._challenger_streak: int = 0

    def detect(self, frame: np.ndarray) -> list[Detection]:
        fh, fw = frame.shape[:2]

        # 1. Resize full frame to YOLO input size
        preprocessed = preprocess(frame)
        scale_x = fw / TARGET_SIZE[0]
        scale_y = fh / TARGET_SIZE[1]

        # 2. Inference
        results = self.model(preprocessed, conf=self.confidence_threshold, verbose=False)

        # 3. Convert boxes → Detection objects (coordinates in full-frame space)
        raw = build_detections(results, fw, fh, scale_x, scale_y)

        # 4. Filtering (size, lane-side, dual-confidence, HSV)
        filtered = filter_detections(raw, frame)

        # 5. Temporal smoothing — hold last confirmed light for up to _HOLD_FRAMES
        #    consecutive misses to prevent single-frame flicker.
        lights     = [d for d in filtered if d.label in _LIGHT_LABELS]
        non_lights = [d for d in filtered if d.label not in _LIGHT_LABELS]

        if lights:
            self._miss_streak = 0
            lights = self._apply_color_stability(lights)
            self._held_lights = lights
        else:
            self._miss_streak += 1
            if self._miss_streak <= _HOLD_FRAMES:
                lights = self._held_lights  # carry forward last good detection
            else:
                # Light gone for too long — reset everything
                self._held_lights = []
                self._confirmed_color = None
                self._challenger_color = None
                self._challenger_streak = 0

        return non_lights + lights

    def _apply_color_stability(self, lights: list[Detection]) -> list[Detection]:
        """Require _COLOR_SWITCH_FRAMES consecutive frames of a new color before
        replacing the currently confirmed color.  Prevents single-frame HSV
        misclassifications (e.g. yellow housing → yellow_light) from overriding
        a well-established red/green reading."""
        new_color = lights[0].label  # postprocessor already narrowed to one light

        if self._confirmed_color is None:
            # No confirmed color yet — accept immediately
            self._confirmed_color = new_color
            self._challenger_color = None
            self._challenger_streak = 0
            return lights

        if new_color == self._confirmed_color:
            # Same color — reinforce confirmed, reset any challenger
            self._challenger_color = None
            self._challenger_streak = 0
            return lights

        # Generic "traffic_light" (HSV couldn't resolve color) — keep confirmed
        if new_color == "traffic_light" and self._confirmed_color != "traffic_light":
            self._challenger_color = None
            self._challenger_streak = 0
            return [Detection(
                label=self._confirmed_color,
                confidence=lights[0].confidence,
                bbox=lights[0].bbox,
                severity=lights[0].severity,
            )]

        # Different specific color — challenger logic
        if new_color == self._challenger_color:
            self._challenger_streak += 1
        else:
            self._challenger_color = new_color
            self._challenger_streak = 1

        if self._challenger_streak >= _COLOR_SWITCH_FRAMES:
            # Challenger has held long enough — promote to confirmed
            self._confirmed_color = new_color
            self._challenger_color = None
            self._challenger_streak = 0
            return lights
        else:
            # Challenger hasn't proven itself — output confirmed color with new bbox
            return [Detection(
                label=self._confirmed_color,
                confidence=lights[0].confidence,
                bbox=lights[0].bbox,
                severity=lights[0].severity,
            )]


# Quick local test — run with: python -m app.vision.detector <image>
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
