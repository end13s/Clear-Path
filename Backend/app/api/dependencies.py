from functools import lru_cache

from app.vision.detector import Detector
from app.core.config import settings


@lru_cache(maxsize=1)
def get_detector() -> Detector:
    return Detector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
    )
