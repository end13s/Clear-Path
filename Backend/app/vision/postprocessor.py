from app.core.schemas import Detection
from app.vision.labels import get_label


def build_detections(results, orig_w: int, orig_h: int, scale_x: float, scale_y: float) -> list[Detection]:
    """
    Convert raw YOLOv8 result boxes into Detection schema objects,
    scaling bounding boxes back to original frame dimensions.
    """
    detections: list[Detection] = []

    for box in results[0].boxes:
        class_id = int(box.cls[0])
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
