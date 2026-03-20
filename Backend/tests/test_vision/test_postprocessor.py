from unittest.mock import MagicMock
import torch

from app.vision.postprocessor import build_detections


def _make_mock_results(class_id: int, confidence: float, box: list[float]):
    """Helper to mock a single YOLOv8 result box."""
    mock_box = MagicMock()
    mock_box.cls = [class_id]
    mock_box.conf = [confidence]
    mock_box.xyxy = [torch.tensor(box)]

    mock_result = MagicMock()
    mock_result.boxes = [mock_box]

    return [mock_result]


def test_build_detections_scales_correctly():
    results = _make_mock_results(
        class_id=2,           # red_light
        confidence=0.9,
        box=[100.0, 50.0, 200.0, 150.0],  # xyxy in 640x640 space
    )
    detections = build_detections(results, orig_w=1280, orig_h=720, scale_x=2.0, scale_y=1.125)

    assert len(detections) == 1
    d = detections[0]
    assert d.label == "red_light"
    assert d.severity == "critical"
    assert d.bbox[0] == 200   # x1 * scale_x
    assert d.bbox[1] == 56    # y1 * scale_y (rounded)
