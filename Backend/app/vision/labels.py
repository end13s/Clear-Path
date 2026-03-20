# Maps YOLO class index → (label, severity)
# Update these once you know the class order of your trained model.

LABEL_MAP: dict[int, tuple[str, str]] = {
    0: ("green_light",   "info"),
    1: ("yellow_light",  "warning"),
    2: ("red_light",     "critical"),
    3: ("stop_sign",     "critical"),
    4: ("yield_sign",    "warning"),
    5: ("speed_limit",   "info"),
    # add more as needed
}


def get_label(class_id: int) -> tuple[str, str]:
    return LABEL_MAP.get(class_id, ("unknown", "info"))
