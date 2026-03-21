import numpy as np
import pytest

from app.vision.preprocessor import (
    TARGET_SIZE,
    classify_traffic_light_color,
    crop_bbox,
    preprocess,
    split_traffic_light_sections,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _solid(color_bgr: tuple[int, int, int], h: int = 90, w: int = 30) -> np.ndarray:
    """Return a solid-color BGR image of the given size."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:] = color_bgr
    return img


def _traffic_light_image(active: str, h: int = 90, w: int = 30) -> np.ndarray:
    """
    Return a synthetic traffic light image (h x w) where only the active
    section is lit and the other two are dark.

    active: "red" | "yellow" | "green"
    """
    RED_BGR    = (0,   0,   255)
    YELLOW_BGR = (0,   255, 255)
    GREEN_BGR  = (0,   255, 0)

    third = h // 3
    img = np.zeros((h, w, 3), dtype=np.uint8)

    if active == "red":
        img[0:third, :] = RED_BGR
    elif active == "yellow":
        img[third:2 * third, :] = YELLOW_BGR
    elif active == "green":
        img[2 * third:, :] = GREEN_BGR

    return img


# ---------------------------------------------------------------------------
# preprocess
# ---------------------------------------------------------------------------

def test_preprocess_output_size():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    result = preprocess(frame)
    assert result.shape == (TARGET_SIZE[1], TARGET_SIZE[0], 3)


def test_preprocess_preserves_dtype():
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = preprocess(frame)
    assert result.dtype == np.uint8


# ---------------------------------------------------------------------------
# crop_bbox
# ---------------------------------------------------------------------------

def test_crop_bbox_basic():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    frame[10:30, 20:50] = (0, 255, 0)  # mark a region
    cropped = crop_bbox(frame, [20, 10, 30, 20])
    assert cropped.shape == (20, 30, 3)
    assert np.all(cropped == (0, 255, 0))


def test_crop_bbox_clamps_to_frame():
    frame = np.zeros((50, 50, 3), dtype=np.uint8)
    # bbox extends outside the frame — should clamp, not crash
    cropped = crop_bbox(frame, [40, 40, 30, 30])
    assert cropped.shape == (10, 10, 3)


def test_crop_bbox_fully_out_of_bounds_returns_empty():
    frame = np.zeros((50, 50, 3), dtype=np.uint8)
    cropped = crop_bbox(frame, [100, 100, 10, 10])
    assert cropped.size == 0


# ---------------------------------------------------------------------------
# split_traffic_light_sections
# ---------------------------------------------------------------------------

def test_split_sections_keys():
    region = np.zeros((90, 30, 3), dtype=np.uint8)
    sections = split_traffic_light_sections(region)
    assert set(sections.keys()) == {"red", "yellow", "green"}


def test_split_sections_heights():
    region = np.zeros((90, 30, 3), dtype=np.uint8)
    sections = split_traffic_light_sections(region)
    assert sections["red"].shape[0]    == 30
    assert sections["yellow"].shape[0] == 30
    assert sections["green"].shape[0]  == 30


def test_split_sections_correct_pixels():
    """Each third should contain the color painted there."""
    RED_BGR    = (0,   0,   255)
    YELLOW_BGR = (0,   255, 255)
    GREEN_BGR  = (0,   255, 0)

    region = np.zeros((90, 30, 3), dtype=np.uint8)
    region[0:30,  :] = RED_BGR
    region[30:60, :] = YELLOW_BGR
    region[60:,   :] = GREEN_BGR

    sections = split_traffic_light_sections(region)
    assert np.all(sections["red"]    == RED_BGR)
    assert np.all(sections["yellow"] == YELLOW_BGR)
    assert np.all(sections["green"]  == GREEN_BGR)


# ---------------------------------------------------------------------------
# classify_traffic_light_color
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("active", ["red", "yellow", "green"])
def test_classify_correct_active_light(active: str):
    region = _traffic_light_image(active)
    result = classify_traffic_light_color(region)
    assert result == active


def test_classify_empty_region_returns_unknown():
    empty = np.empty((0, 0, 3), dtype=np.uint8)
    assert classify_traffic_light_color(empty) == "unknown"


def test_classify_all_dark_returns_unknown():
    dark = np.zeros((90, 30, 3), dtype=np.uint8)
    assert classify_traffic_light_color(dark) == "unknown"
