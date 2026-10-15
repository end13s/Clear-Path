from unittest.mock import MagicMock

import numpy as np
import torch

from app.core.schemas import Detection
from app.vision.postprocessor import build_detections, filter_detections

# COCO class IDs used by the stock yolov8n model (see app/vision/labels.py)
PERSON, TRAFFIC_LIGHT, STOP_SIGN, CAR = 0, 9, 11, 2


def _make_mock_results(class_id: int, confidence: float, box: list[float]):
    """Helper to mock a single YOLOv8 result box."""
    mock_box = MagicMock()
    mock_box.cls = [class_id]
    mock_box.conf = [confidence]
    mock_box.xyxy = [torch.tensor(box)]

    mock_result = MagicMock()
    mock_result.boxes = [mock_box]

    return [mock_result]


def _traffic_light_frame(active_bgr: tuple[int, int, int], bbox: list[int], frame_hw=(720, 1280)) -> np.ndarray:
    """Dark frame with a lit bulb in the top third of `bbox` (red position)."""
    frame = np.zeros((*frame_hw, 3), dtype=np.uint8)
    x, y, w, h = bbox
    frame[y:y + h, x:x + w] = (30, 30, 30)                      # housing
    cx, cy, r = x + w // 2, y + h // 6, max(2, w // 3)
    frame[cy - r:cy + r, cx - r:cx + r] = active_bgr             # lit bulb
    return frame


def test_build_detections_scales_correctly():
    results = _make_mock_results(
        class_id=STOP_SIGN,
        confidence=0.9,
        box=[100.0, 50.0, 200.0, 150.0],  # xyxy in 640x640 space
    )
    detections = build_detections(results, orig_w=1280, orig_h=720, scale_x=2.0, scale_y=1.125)

    assert len(detections) == 1
    d = detections[0]
    assert d.label == "stop_sign"
    assert d.severity == "critical"
    assert d.bbox == [200, 56, 200, 112]   # x, y, w, h scaled back to 1280x720


def test_build_detections_maps_unmapped_class_to_unknown():
    results = _make_mock_results(class_id=CAR, confidence=0.8, box=[0.0, 0.0, 10.0, 10.0])
    [d] = build_detections(results, orig_w=640, orig_h=640, scale_x=1.0, scale_y=1.0)
    assert d.label == "unknown"


def test_filter_drops_unknown_labels():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    d = Detection(label="unknown", confidence=0.9, bbox=[600, 300, 50, 50], severity="info")
    assert filter_detections([d], frame) == []


def test_filter_keeps_stop_sign():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    d = Detection(label="stop_sign", confidence=0.9, bbox=[600, 300, 60, 60], severity="critical")
    assert filter_detections([d], frame) == [d]


def test_filter_refines_generic_traffic_light_to_red():
    bbox = [620, 150, 30, 90]
    frame = _traffic_light_frame((0, 0, 255), bbox)
    d = Detection(label="traffic_light", confidence=0.6, bbox=bbox, severity="warning")

    [out] = filter_detections([d], frame)
    assert out.label == "red_light"


def test_filter_rejects_light_near_bottom_of_frame():
    # Centre at 90 % of frame height: hood / road reflection, not a signal
    bbox = [620, 600, 30, 90]
    frame = _traffic_light_frame((0, 0, 255), bbox)
    d = Detection(label="traffic_light", confidence=0.6, bbox=bbox, severity="warning")
    assert filter_detections([d], frame) == []


def test_filter_rejects_uniform_red_square_as_traffic_light():
    # A solid red tall box reads as a stop sign, not a lit bulb in a dark housing
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    bbox = [620, 150, 40, 80]
    frame[150:230, 620:660] = (0, 0, 255)
    d = Detection(label="traffic_light", confidence=0.6, bbox=bbox, severity="warning")
    assert filter_detections([d], frame) == []
