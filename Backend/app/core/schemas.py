from pydantic import BaseModel


class Detection(BaseModel):
    label: str           # e.g. "stop_sign", "red_light"
    confidence: float
    bbox: list[int]      # [x, y, width, height]
    severity: str        # "info" | "warning" | "critical"


class DetectionResponse(BaseModel):
    detections: list[Detection]
    frame_width: int
    frame_height: int
