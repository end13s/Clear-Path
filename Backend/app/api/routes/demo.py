import base64
import threading

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_demo_detector, get_video_streamer
from app.core.schemas import DemoFrameResponse
from app.vision.detector import Detector
from app.vision.video_streamer import VideoStreamer

router = APIRouter()

# ── Async detection state ─────────────────────────────────────────────────────
# Frames are returned immediately; YOLO runs in a background thread and
# updates _cached_detections when done. Each response carries the latest
# available detections — typically 1-2 frames behind, imperceptible to viewers.

_cached_detections: list = []
_cached_dims: tuple[int, int] = (1920, 1080)   # (w, h) of last detected frame
_detecting = False
_state_lock = threading.Lock()


def _run_detection(detector: Detector, frame: np.ndarray) -> None:
    global _cached_detections, _cached_dims, _detecting
    try:
        result = detector.detect(frame)
        h, w = frame.shape[:2]
        with _state_lock:
            _cached_detections = result
            _cached_dims = (w, h)
    finally:
        with _state_lock:
            _detecting = False


# ─────────────────────────────────────────────────────────────────────────────

@router.get("/videos")
def list_videos(streamer: VideoStreamer = Depends(get_video_streamer)):
    """Return the list of available demo video filenames."""
    return {"videos": streamer.available_videos()}


@router.get("/detect", response_model=DemoFrameResponse)
def demo_detect(
    video: str = Query(default="red1.mp4"),
    position_ms: int = Query(default=0),
    detector: Detector = Depends(get_demo_detector),
    streamer: VideoStreamer = Depends(get_video_streamer),
):
    """Seek to position_ms in the video, run detection, return results only.
    No image encoding — designed to pair with a native video player on the phone."""
    frame = streamer.get_frame_at(video, position_ms)
    if frame is None:
        raise HTTPException(status_code=404, detail=f"Video not found or unreadable: {video}")

    h, w = frame.shape[:2]
    detections = detector.detect(frame)

    return DemoFrameResponse(
        detections=detections,
        frame_width=w,
        frame_height=h,
        frame_b64="",   # not used by this endpoint
    )


@router.get("/frame", response_model=DemoFrameResponse)
def demo_frame(
    video: str = Query(default="red1.mp4"),
    detector: Detector = Depends(get_demo_detector),
    streamer: VideoStreamer = Depends(get_video_streamer),
):
    global _detecting

    frame = streamer.get_frame(video)
    if frame is None:
        raise HTTPException(status_code=404, detail=f"Video not found or unreadable: {video}")

    h, w = frame.shape[:2]

    # Kick off YOLO in background if not already running
    with _state_lock:
        should_detect = not _detecting
        if should_detect:
            _detecting = True

    if should_detect:
        t = threading.Thread(target=_run_detection, args=(detector, frame.copy()), daemon=True)
        t.start()

    # Return frame immediately with latest cached detections
    with _state_lock:
        detections = list(_cached_detections)
        det_w, det_h = _cached_dims

    display = cv2.resize(frame, (960, 540))
    _, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_b64 = base64.b64encode(buf).decode()

    return DemoFrameResponse(
        detections=detections,
        frame_width=det_w,
        frame_height=det_h,
        frame_b64=frame_b64,
    )
