# Maps YOLO class index → (label, severity)
# Update these once you know the class order of your trained model.

LABEL_MAP: dict[int, tuple[str, str]] = {
    # COCO class IDs (standard yolov8n)
    0:  ("person",        "warning"),
    9:  ("traffic_light", "warning"),   # color refined by HSV in postprocessor
    11: ("stop_sign",     "critical"),
}


def get_label(class_id: int) -> tuple[str, str]:
    return LABEL_MAP.get(class_id, ("unknown", "info"))
