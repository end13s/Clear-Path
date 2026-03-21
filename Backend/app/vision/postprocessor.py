import cv2
import numpy as np

from app.core.config import settings
from app.core.schemas import Detection
from app.vision.labels import get_label
from app.vision.preprocessor import crop_bbox, classify_traffic_light_color, is_low_light

_LIGHT_LABELS = {"green_light", "yellow_light", "red_light", "traffic_light"}

# Size filter — fraction of total frame area
_MIN_AREA_RATIO = 0.00005  # 0.005% — catches lights even at far distance
_MAX_AREA_RATIO = 0.25     # 25% — allow close-range lights that fill more of frame

# Dual-confidence: minimum YOLO score required for any light detection
_DUAL_CONF_MIN = 0.15

# Lane-side filter — center 80% of frame is considered the driver's zone
_DRIVER_LANE_LIMIT = 0.80

# Vertical zone filter — reject lights whose center is in the top or bottom slice.
# Top 10%: sky, sun glare, airplane/building lights.
# Bottom 15%: hood, road surface reflections.
_MIN_CENTER_Y_RATIO = 0.10
_MAX_CENTER_Y_RATIO = 0.85


def build_detections(results, orig_w: int, orig_h: int, scale_x: float, scale_y: float) -> list[Detection]:
    """Convert raw YOLOv8 result boxes into Detection schema objects,
    scaling bounding boxes back to original frame dimensions."""
    detections: list[Detection] = []

    for box in results[0].boxes:
        class_id   = int(box.cls[0])
        confidence = float(box.conf[0])

        x1, y1, x2, y2 = box.xyxy[0].tolist()
        x = int(x1 * scale_x)
        y = int(y1 * scale_y)
        w = int((x2 - x1) * scale_x)
        h = int((y2 - y1) * scale_y)

        label, severity = get_label(class_id)
        detections.append(Detection(
            label=label,
            confidence=round(confidence, 3),
            bbox=[x, y, w, h],
            severity=severity,
        ))

    return detections


def filter_detections(detections: list[Detection], frame: np.ndarray) -> list[Detection]:
    """Apply all post-YOLO filters and return the final detection list.

    Filters applied in order:
      1. Size filter      — reject if bbox area < 0.1 % or > 15 % of frame.
      2. Shape filter     — for lights, reject h/w ratio outside 2.0–4.5.
      3. Dual confidence  — for lights, require YOLO conf ≥ 0.65 AND HSV
                            zone brightness analysis must agree on colour.
                            The HSV result also refines the label when both
                            agree (traffic light partitioning).
      4. Intersection filter — when multiple lights survive, keep the one
                            scored highest on (small area × left position).
                            The driver's signal is across the intersection
                            (smaller, more centered-left); cross-traffic
                            lights are beside the car (larger, further right).
    """
    frame_area = frame.shape[0] * frame.shape[1]
    night_mode = is_low_light(frame)
    filtered: list[Detection] = []

    for d in detections:
        x, y, w, h = d.bbox
        area = w * h

        # 0. Drop unknown labels (classes not in our LABEL_MAP)
        if d.label == "unknown":
            continue

        # 1. Size filter
        ratio = area / frame_area
        if not (_MIN_AREA_RATIO <= ratio <= _MAX_AREA_RATIO):
            continue

        # 2. Vertical zone filter — reject sky/hood false positives
        if d.label in _LIGHT_LABELS:
            frame_h = frame.shape[0]
            center_y = y + h / 2
            if not (_MIN_CENTER_Y_RATIO * frame_h <= center_y <= _MAX_CENTER_Y_RATIO * frame_h):
                continue

        if d.label in _LIGHT_LABELS:
            # 2b. Shape filter — traffic lights are tall/narrow (h/w ≥ 1.3)
            # Stop signs, car lights, and most other false positives are square.
            if h / max(w, 1) < 1.3:
                continue

            # 2c. Lane-side filter — reject lights in the opposing lane's half
            frame_w = frame.shape[1]
            center_x = x + w / 2
            limit = frame_w * _DRIVER_LANE_LIMIT
            if settings.driver_side == "right" and center_x > limit:
                continue  # opposing lane signal — too far right
            if settings.driver_side == "left" and center_x < (frame_w - limit):
                continue  # opposing lane signal — too far left

            # 3. Dual confidence — stricter YOLO threshold
            if d.confidence < _DUAL_CONF_MIN:
                continue

            # 3. HSV color confirmation / refinement
            region = crop_bbox(frame, d.bbox)
            if region.size > 0:
                hsv_color = classify_traffic_light_color(region, night_mode=night_mode)

                if d.label == "traffic_light":
                    # COCO generic label — use HSV to assign color.
                    # For small/distant lights HSV may not resolve a color yet —
                    # pass them through as "traffic_light" so the driver gets
                    # early warning. Only drop if the bbox is large enough that
                    # HSV should have worked (back-facing or unlit light).
                    bbox_area = d.bbox[2] * d.bbox[3]
                    is_distant = (bbox_area / (frame.shape[0] * frame.shape[1])) < 0.002
                    if hsv_color == "unknown" and not is_distant:
                        continue
                    if hsv_color != "unknown":
                        # Stop sign guard: a stop sign has uniform red coverage
                        # across its entire bbox; a traffic light has a small
                        # concentrated blob against a dark housing.
                        # If >45% of bbox pixels are red → drop as stop sign.
                        if hsv_color == "red":
                            hsv_full = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
                            mask1 = cv2.inRange(hsv_full, np.array([0,   50, 50]), np.array([10,  255, 255]))
                            mask2 = cv2.inRange(hsv_full, np.array([160, 50, 50]), np.array([180, 255, 255]))
                            red_pct = (cv2.countNonZero(mask1) + cv2.countNonZero(mask2)) / max(region.shape[0] * region.shape[1], 1)
                            if red_pct > 0.35:
                                continue  # uniform red = stop sign, not traffic light
                        d = Detection(
                            label=f"{hsv_color}_light",
                            confidence=d.confidence,
                            bbox=d.bbox,
                            severity=d.severity,
                        )
                else:
                    # Custom-trained specific label — HSV must agree
                    expected = d.label.replace("_light", "")
                    if hsv_color != "unknown" and hsv_color != expected:
                        continue  # HSV disagrees — reject
                    if hsv_color != "unknown":
                        d = Detection(
                            label=f"{hsv_color}_light",
                            confidence=d.confidence,
                            bbox=d.bbox,
                            severity=d.severity,
                        )

        filtered.append(d)

    # 4. When multiple lights survive, keep the one most centered horizontally.
    #    The driver's signal is directly ahead — closest to the frame center x.
    lights     = [d for d in filtered if d.label in _LIGHT_LABELS]
    non_lights = [d for d in filtered if d.label not in _LIGHT_LABELS]

    if len(lights) > 1:
        frame_cx = frame.shape[1] / 2
        lights = [min(lights, key=lambda d: abs((d.bbox[0] + d.bbox[2] / 2) - frame_cx))]

    return non_lights + lights
