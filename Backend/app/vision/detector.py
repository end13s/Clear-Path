import numpy as np
from collections import deque
from ultralytics import YOLO

from app.core.schemas import Detection
from app.vision.preprocessor import TARGET_SIZE, preprocess
from app.vision.postprocessor import build_detections, filter_detections

_LIGHT_LABELS = {"green_light", "yellow_light", "red_light", "traffic_light"}
_HOLD_FRAMES = 5        # hold last confirmed light for up to this many consecutive misses
_COLOR_SWITCH_FRAMES = 2  # consecutive frames of a new color needed to displace confirmed color
_EMA_ALPHA_UP   = 0.70         # weight for new frame when confidence is rising
_EMA_ALPHA_DOWN = 0.05         # weight for new frame when confidence is falling (slow decay)
_EMA_CAP = 0.95                # max reported confidence once detection is stable
_STABILITY_BOOST = 0.12        # multiplier added per consecutive confirmed frame


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
        # Confidence smoothing
        self._ema_confidence: float | None = None  # exponential moving average of confidence
        self._confirmed_streak: int = 0            # consecutive frames on confirmed color

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
                self._confirmed_streak = 0
                self._ema_confidence = None

        return non_lights + lights

    def _smooth_confidence(self, raw: float) -> float:
        """Asymmetric EMA: rises quickly, falls slowly.
        Stability boost compounds with consecutive confirmed frames, capped at _EMA_CAP."""
        if self._ema_confidence is None:
            self._ema_confidence = raw
        else:
            alpha = _EMA_ALPHA_UP if raw >= self._ema_confidence else _EMA_ALPHA_DOWN
            self._ema_confidence = alpha * raw + (1 - alpha) * self._ema_confidence
        boosted = self._ema_confidence * (1.0 + self._confirmed_streak * _STABILITY_BOOST)
        return round(min(boosted, _EMA_CAP), 3)

    def _make_detection(self, template: Detection, label: str, smoothed_conf: float) -> Detection:
        return Detection(
            label=label,
            confidence=smoothed_conf,
            bbox=template.bbox,
            severity=template.severity,
        )

    def _apply_color_stability(self, lights: list[Detection]) -> list[Detection]:
        """Require _COLOR_SWITCH_FRAMES consecutive frames of a new color before
        replacing the currently confirmed color.  Prevents single-frame HSV
        misclassifications (e.g. yellow housing → yellow_light) from overriding
        a well-established red/green reading.
        Confidence is smoothed via EMA so it rises steadily as detection stabilises."""
        d = lights[0]  # postprocessor already narrowed to one light
        new_color = d.label
        conf = self._smooth_confidence(d.confidence)

        if self._confirmed_color is None:
            # No confirmed color yet — accept immediately
            self._confirmed_color = new_color
            self._challenger_color = None
            self._challenger_streak = 0
            self._confirmed_streak = 1
            return [self._make_detection(d, new_color, conf)]

        if new_color == self._confirmed_color:
            # Same color — reinforce confirmed, grow streak, reset any challenger
            self._confirmed_streak += 1
            self._challenger_color = None
            self._challenger_streak = 0
            return [self._make_detection(d, self._confirmed_color, conf)]

        # Generic "traffic_light" (HSV couldn't resolve color) — keep confirmed, keep growing streak
        if new_color == "traffic_light" and self._confirmed_color != "traffic_light":
            self._confirmed_streak += 1
            self._challenger_color = None
            self._challenger_streak = 0
            return [self._make_detection(d, self._confirmed_color, conf)]

        # Different specific color — challenger logic
        if new_color == self._challenger_color:
            self._challenger_streak += 1
        else:
            self._challenger_color = new_color
            self._challenger_streak = 1

        if self._challenger_streak >= _COLOR_SWITCH_FRAMES:
            # Challenger held long enough — promote and reset EMA + streak for new color
            self._confirmed_color = new_color
            self._challenger_color = None
            self._challenger_streak = 0
            self._confirmed_streak = 1
            self._ema_confidence = d.confidence  # restart EMA from raw value
            conf = round(d.confidence, 3)
            return [self._make_detection(d, new_color, conf)]
        else:
            # Challenger hasn't proven itself — output confirmed color, streak keeps growing
            self._confirmed_streak += 1
            return [self._make_detection(d, self._confirmed_color, conf)]


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
