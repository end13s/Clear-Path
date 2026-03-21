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

        if d.label in _LIGHT_LABELS:
            # 2b. Lane-side filter — reject lights in the opposing lane's half
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
