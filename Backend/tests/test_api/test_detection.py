from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import get_detector
from app.core.schemas import Detection


def test_detect_frame_returns_detections(tmp_path):
    # Create a dummy 10x10 white JPEG
    import cv2, numpy as np
    img_path = tmp_path / "frame.jpg"
    cv2.imwrite(str(img_path), np.ones((10, 10, 3), dtype=np.uint8) * 255)

    mock_detector = MagicMock()
    mock_detector.detect.return_value = [
        Detection(label="red_light", confidence=0.95, bbox=[0, 0, 5, 5], severity="critical")
    ]

    app.dependency_overrides[get_detector] = lambda: mock_detector

    with TestClient(app) as client:
        with open(img_path, "rb") as f:
            response = client.post("/detect/frame", files={"file": ("frame.jpg", f, "image/jpeg")})

    assert response.status_code == 200
    data = response.json()
    assert len(data["detections"]) == 1
    assert data["detections"][0]["label"] == "red_light"

    app.dependency_overrides.clear()
