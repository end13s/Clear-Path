from functools import lru_cache

from app.vision.detector import Detector
from app.vision.video_streamer import VideoStreamer
from app.core.config import settings


@lru_cache(maxsize=1)
def get_detector() -> Detector:
    return Detector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
    )


@lru_cache(maxsize=1)
def get_demo_detector() -> Detector:
    """Separate Detector instance for demo mode — independent temporal state."""
    return Detector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
    )


@lru_cache(maxsize=1)
def get_video_streamer() -> VideoStreamer:
    return VideoStreamer()
