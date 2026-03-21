import numpy as np
import cv2
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException

from app.api.dependencies import get_detector
from app.core.schemas import DetectionResponse
from app.vision.detector import Detector

router = APIRouter()


@router.post("/frame", response_model=DetectionResponse)
async def detect_frame(
    file: UploadFile = File(...),
    detector: Detector = Depends(get_detector),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    raw = await file.read()
    buf = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=422, detail="Could not decode image.")

    detections = detector.detect(frame)
    h, w = frame.shape[:2]

    if detections:
        print([f"{d.label}:{d.confidence:.2f}" for d in detections])

    return DetectionResponse(detections=detections, frame_width=w, frame_height=h)
