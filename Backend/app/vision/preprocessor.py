import cv2
import numpy as np

# YOLOv8 default input size
TARGET_SIZE = (640, 640)

# HSV color ranges for traffic light classification (close-range, high precision)
RED_LOWER_1  = np.array([0,   60, 60])
RED_UPPER_1  = np.array([10,  255, 255])

RED_LOWER_2  = np.array([160, 60, 60])
RED_UPPER_2  = np.array([179, 255, 255])

YELLOW_LOWER = np.array([15,  100, 100])
YELLOW_UPPER = np.array([35,  255, 255])

GREEN_LOWER  = np.array([40,  40,  40])
GREEN_UPPER  = np.array([90,  255, 255])

# Relaxed HSV ranges used only for auto-detection — lower saturation/value
# thresholds so distant or partially washed-out lights are still found.
_DET_RED_LOWER_1  = np.array([0,   40, 60])
_DET_RED_UPPER_1  = np.array([10,  255, 255])
_DET_RED_LOWER_2  = np.array([160, 40, 60])
_DET_RED_UPPER_2  = np.array([179, 255, 255])
_DET_YELLOW_LOWER = np.array([15,  40, 60])
_DET_YELLOW_UPPER = np.array([35,  255, 255])
_DET_GREEN_LOWER  = np.array([40,  30, 40])
_DET_GREEN_UPPER  = np.array([90,  255, 255])

# Nighttime mode
NIGHT_BRIGHTNESS_THRESHOLD = 80   # mean V channel below this → low-light / night
_NIGHT_BLOOM_MIN            = 80   # minimum peak V for an active bulb to register
_NIGHT_BLOOM_RATIO          = 1.4  # winning zone must be this much brighter than second-best


# ---------------------------------------------------------------------------
# Configurable frame zone proportions.
# Change ONE constant here and the entire pipeline adapts automatically.
# Horizontal thirds must sum to 1.0; vertical halves must sum to 1.0.
# ---------------------------------------------------------------------------
ZONE_LEFT_RATIO   = 0.25   # outer-left strip  — other-lane signals, ignored
ZONE_MIDDLE_RATIO = 0.50   # centre strip       — driver's lane, scanned
ZONE_RIGHT_RATIO  = 0.25   # outer-right strip  — other-lane signals, ignored

ZONE_TOP_RATIO    = 0.40   # top strip height   — lights are overhead, scanned
ZONE_BOTTOM_RATIO = 0.60   # bottom strip height — road surface, ignored


def get_zone_of_interest(
    frame: np.ndarray,
) -> tuple[np.ndarray, int, int]:
    """Crop the TOP × MIDDLE zone from a full frame.

    Only this zone is passed to YOLO and the HSV detector — everything outside
    it is ignored, eliminating signals from other lanes and the road surface.

    Returns:
        (zone, x_offset, y_offset) where zone is the cropped image and
        x_offset / y_offset are the pixel distances from the frame origin
        needed to translate zone-space coordinates back to frame space.
    """
    fh, fw = frame.shape[:2]
    x0 = int(fw * ZONE_LEFT_RATIO)
    x1 = fw - int(fw * ZONE_RIGHT_RATIO)
    y1 = int(fh * ZONE_TOP_RATIO)
    return frame[0:y1, x0:x1], x0, 0


def preprocess(frame: np.ndarray) -> np.ndarray:
    return cv2.resize(frame, TARGET_SIZE)


def crop_bbox(frame: np.ndarray, bbox: list[int]) -> np.ndarray:
    """Crop a bounding box region from a frame.

    Args:
        frame: BGR image as a numpy array.
        bbox:  [x, y, w, h] in pixel coordinates relative to the frame.

    Returns:
        Cropped BGR region, or an empty array if the bbox is out of bounds.
    """
    x, y, w, h = bbox
    fh, fw = frame.shape[:2]

    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(fw, x + w)
    y2 = min(fh, y + h)

    if x2 <= x1 or y2 <= y1:
        return np.empty((0, 0, 3), dtype=np.uint8)

    return frame[y1:y2, x1:x2]


def is_low_light(frame: np.ndarray) -> bool:
    """Return True when average frame brightness indicates night / low-light.

    Uses the mean of the HSV Value channel so the check is independent of
    colour temperature — it responds equally to LED, sodium, and HID sources.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    return float(np.mean(hsv[:, :, 2])) < NIGHT_BRIGHTNESS_THRESHOLD


def _center_crop(section: np.ndarray, ratio: float = 0.5) -> np.ndarray:
    """Return the central `ratio` fraction of a section image.

    Isolates the area where the bulb sits inside the housing, discarding
    the dark casing border that dominates at night.
    """
    h, w = section.shape[:2]
    pad_y = int(h * (1 - ratio) / 2)
    pad_x = int(w * (1 - ratio) / 2)
    cropped = section[max(0, pad_y):max(1, h - pad_y),
                      max(0, pad_x):max(1, w - pad_x)]
    return cropped if cropped.size > 0 else section


def _bloom_score(section: np.ndarray) -> float:
    """Peak brightness of the central bloom in a single partitioned zone.

    At night the active bulb is the only light source; the center crop
    isolates the bulb position and the 95th-percentile V value captures
    the bright bloom while ignoring stray noise pixels.
    """
    center = _center_crop(section)
    if center.size == 0:
        return 0.0
    hsv = cv2.cvtColor(center, cv2.COLOR_BGR2HSV)
    return float(np.percentile(hsv[:, :, 2], 95))


def _classify_night(region: np.ndarray) -> str:
    """Identify active light by brightness bloom in each partitioned zone center.

    In low-light conditions the physical housing is invisible; only the
    active bulb emits enough light to produce a detectable bloom.  The
    zone with a clearly dominant peak brightness wins.
    """
    sections = split_traffic_light_sections(region)
    bloom = {color: _bloom_score(sec) for color, sec in sections.items()}

    best_color = max(bloom, key=lambda c: bloom[c])
    best_score = bloom[best_color]

    if best_score < _NIGHT_BLOOM_MIN:
        return "unknown"

    scores = sorted(bloom.values(), reverse=True)
    second = scores[1] if len(scores) > 1 else 0
    if second > 0 and best_score / second < _NIGHT_BLOOM_RATIO:
        return "unknown"  # no clear winner — too ambiguous to act on

    return best_color


def _group_vertical_circles(
    blobs: list[tuple[int, int, float]],
) -> list[list[tuple[int, int, float]]]:
    """Group (cx, cy, r) blobs that share approximately the same x column.

    Two blobs are considered in the same column when their centres are within
    2.5× the larger radius horizontally — i.e. they could plausibly belong to
    the same vertical stack of traffic-light bulbs.
    """
    groups: list[list[tuple[int, int, float]]] = []
    used: set[int] = set()

    for i, (cx1, cy1, r1) in enumerate(blobs):
        if i in used:
            continue
        group: list[tuple[int, int, float]] = [(cx1, cy1, r1)]
        used.add(i)
        for j, (cx2, cy2, r2) in enumerate(blobs):
            if j in used:
                continue
            if abs(cx2 - cx1) <= max(r1, r2) * 2.5:
                group.append((cx2, cy2, r2))
                used.add(j)
        if len(group) >= 2:
            groups.append(group)

    return groups


def _circles_to_bbox(
    group: list[tuple[int, int, float]],
    x_offset: int,
    search_h: int,
    fw: int,
    fh: int,
) -> list[int]:
    """Convert a group of circle tuples into a padded [x, y, w, h] bbox.

    Coordinates are translated from ROI space back to full-frame space.
    """
    max_r = max(r for _, _, r in group)
    pad   = max_r * 1.5

    min_x = max(0,        min(cx - r for cx, _,  r in group) - pad)
    max_x = min(fw - x_offset, max(cx + r for cx, _,  r in group) + pad)
    min_y = max(0,        min(cy - r for _,  cy, r in group) - pad)
    max_y = min(search_h, max(cy + r for _,  cy, r in group) + pad)

    x = int(min_x) + x_offset
    y = int(min_y)
    w = min(fw - x, int(max_x - min_x))
    h = int(max_y - min_y)
    return [x, y, w, h]


def detect_traffic_light_bbox(frame: np.ndarray) -> list[int] | None:
    """Automatically locate the driver's traffic light in the frame.

    Scoping strategy (two axes):

    Vertical  — upper 65 % only: traffic lights are overhead; cars, road
                markings and brake lights live in the lower half.
    Horizontal — centre 60 % only: the relevant signal is straight ahead in
                the driver's lane.  Signals for adjacent lanes are near the
                frame edges and are ignored.

    Detection strategy (two stages):

    Primary   — circular-blob detection.  Individual traffic-light bulbs are
                round; most false positives (signs, car bonnets, buildings)
                are not.  Blobs with circularity ≥ 0.45 are found and those
                that share approximately the same x column are grouped.  The
                group with the most circles wins.

    Fallback  — for very distant lights whose bulbs are only a few pixels
                wide (too small to measure circularity reliably), the mask is
                dilated so the three blobs merge and the resulting contour is
                filtered by aspect ratio (1.5–6.0) and frame-relative size.

    Args:
        frame: Full BGR video frame.

    Returns:
        [x, y, w, h] bounding box in full-frame coordinates, or None.
    """
    fh, fw = frame.shape[:2]

    # --- search zone: TOP × MIDDLE (driven by the zone-proportion constants) ---
    search_h = int(fh * ZONE_TOP_RATIO)
    x_start  = int(fw * ZONE_LEFT_RATIO)
    x_end    = fw - int(fw * ZONE_RIGHT_RATIO)
    roi      = frame[:search_h, x_start:x_end]
    roi_h, roi_w = roi.shape[:2]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    red_mask = cv2.add(
        cv2.inRange(hsv, _DET_RED_LOWER_1, _DET_RED_UPPER_1),
        cv2.inRange(hsv, _DET_RED_LOWER_2, _DET_RED_UPPER_2),
    )
    yellow_mask = cv2.inRange(hsv, _DET_YELLOW_LOWER, _DET_YELLOW_UPPER)
    green_mask  = cv2.inRange(hsv, _DET_GREEN_LOWER,  _DET_GREEN_UPPER)
    combined    = cv2.bitwise_or(red_mask, cv2.bitwise_or(yellow_mask, green_mask))

    # ------------------------------------------------------------------ #
    # PRIMARY: find circular blobs (individual bulbs) in the raw mask     #
    # ------------------------------------------------------------------ #
    min_blob = max(4.0,  roi_h * roi_w * 0.00008)
    max_blob = max(10.0, roi_h * roi_w * 0.025)

    blobs: list[tuple[int, int, float]] = []
    raw_contours, _ = cv2.findContours(
        combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    for cnt in raw_contours:
        area = cv2.contourArea(cnt)
        if not (min_blob <= area <= max_blob):
            continue
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4.0 * np.pi * area / (perimeter ** 2)
        if circularity >= 0.45:                      # close to a circle
            bx, by, bw, bh = cv2.boundingRect(cnt)
            blobs.append((bx + bw // 2, by + bh // 2, max(bw, bh) / 2.0))

    if len(blobs) >= 2:
        groups = _group_vertical_circles(blobs)
        if groups:
            best = max(groups, key=lambda g: (len(g), sum(r for _, _, r in g)))
            return _circles_to_bbox(best, x_start, search_h, fw, fh)

    # ------------------------------------------------------------------ #
    # FALLBACK: dilate + aspect-ratio filter (for very distant lights)    #
    # ------------------------------------------------------------------ #
    k      = max(3, int(fw * 0.01))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    dilated = cv2.dilate(combined, kernel, iterations=3)
    dilated = cv2.erode(dilated, kernel, iterations=1)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    frame_area = fh * fw
    result: list[int] | None = None
    best_score = 0.0

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        if not (frame_area * 0.001 <= area <= frame_area * 0.15):
            continue
        aspect = h / max(w, 1)
        if not (2.0 <= aspect <= 4.5):
            continue
        score = area * aspect
        if score > best_score:
            best_score = score
            pad_x = max(3, int(w * 0.15))
            pad_y = max(3, int(h * 0.10))
            result = [
                max(0, x - pad_x) + x_start,
                max(0, y - pad_y),
                min(fw - (max(0, x - pad_x) + x_start), w + 2 * pad_x),
                min(search_h - max(0, y - pad_y), h + 2 * pad_y),
            ]

    return result


def split_traffic_light_sections(region: np.ndarray) -> dict[str, np.ndarray]:
    """Split a cropped traffic light region into three vertical zones.

    Standard vertical traffic lights have red on top, yellow in the middle,
    and green on the bottom.  The ratios below do not need to be equal —
    tweak them if your camera angle or light housing skews one zone.

    Args:
        region: Cropped BGR image of a traffic light bounding box.

    Returns:
        Dict with keys "red", "yellow", "green" mapped to their sub-regions.
    """
    h = region.shape[0]

    # 🔧 EDIT THESE VALUES (must sum to 1.0)
    RED_RATIO    = 0.30   # top portion of the bounding box
    YELLOW_RATIO = 0.30   # middle portion
    GREEN_RATIO  = 0.40   # bottom portion (slightly larger — green housings often taller)

    red_end    = int(h * RED_RATIO)
    yellow_end = int(h * (RED_RATIO + YELLOW_RATIO))

    return {
        "red":    region[0:red_end,        :],
        "yellow": region[red_end:yellow_end, :],
        "green":  region[yellow_end:,        :],
    }


def classify_traffic_light_color(region: np.ndarray, night_mode: bool = False) -> str:
    """Classify active traffic light color using brightest-blob detection.

    Strategy:
      1. Find the single brightest blob in the Value channel — this is always
         the active bulb, never the housing.
      2. Determine color by the blob's vertical position in the bbox:
         top third = red, middle third = yellow, bottom third = green.
      3. Verify by checking HSV color masks on the bright blob pixels only.
         If HSV strongly agrees, return it; otherwise trust position.

    This avoids the section-split + pixel-count approach which was confused
    by the yellow housing shell.
    """
    if region.size == 0:
        return "unknown"

    if night_mode:
        return _classify_night(region)

    h, w = region.shape[:2]
    if h < 6 or w < 3:
        return "unknown"

    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    value = hsv[:, :, 2]

    # Smooth to suppress noise before finding the brightest blob
    blurred = cv2.GaussianBlur(value, (5, 5), 0)
    _, max_val, _, _ = cv2.minMaxLoc(blurred)

    if max_val < 80:
        return "unknown"  # no bulb is bright enough to be active

    # Isolate the bright blob at 78 % of peak brightness — tighter threshold
    # keeps only the actual bulb and excludes the reflective housing
    _, bright_mask = cv2.threshold(blurred, int(max_val * 0.78), 255, cv2.THRESH_BINARY)

    # Find vertical centroid of the bright blob
    M = cv2.moments(bright_mask)
    if M["m00"] == 0:
        return "unknown"
    cy = M["m01"] / M["m00"]

    # Determine color by vertical position
    if cy < h * 0.38:
        pos_color = "red"
    elif cy < h * 0.65:
        pos_color = "yellow"
    else:
        pos_color = "green"

    # Verify HSV color within the bright blob only — ignores housing pixels
    red_count = cv2.countNonZero(cv2.bitwise_and(
        cv2.bitwise_or(
            cv2.inRange(hsv, RED_LOWER_1, RED_UPPER_1),
            cv2.inRange(hsv, RED_LOWER_2, RED_UPPER_2),
        ), bright_mask))
    yellow_count = cv2.countNonZero(cv2.bitwise_and(
        cv2.inRange(hsv, YELLOW_LOWER, YELLOW_UPPER), bright_mask))
    green_count = cv2.countNonZero(cv2.bitwise_and(
        cv2.inRange(hsv, GREEN_LOWER, GREEN_UPPER), bright_mask))

    total = red_count + yellow_count + green_count
    if total > 0:
        best_hsv = max(
            {"red": red_count, "yellow": yellow_count, "green": green_count}.items(),
            key=lambda kv: kv[1],
        )
        second_hsv = sorted([red_count, yellow_count, green_count], reverse=True)[1]
        # Trust HSV if it clearly dominates
        if best_hsv[1] > 0 and (second_hsv == 0 or best_hsv[1] / max(second_hsv, 1) > 1.5):
            return best_hsv[0]

    # HSV inconclusive — trust the vertical position
    return pos_color


# ---------------------------------------------------------------------------
# Local visual test — run with:
#   python -m app.vision.preprocessor <image_or_video>
#
# The traffic light is detected automatically every frame.
# Press 'q' to quit.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else None
    if path is None:
        print("Usage: python -m app.vision.preprocessor <image_or_video>")
        sys.exit(1)

    DISPLAY_W = 200

    # BGR colours used to draw the detection box on the live frame
    BOX_COLOR = {
        "red":     (0,   0,   255),
        "yellow":  (0,   255, 255),
        "green":   (0,   255, 0),
        "unknown": (128, 128, 128),
    }

    def _process_frame(frame: np.ndarray) -> np.ndarray:
        """Detect, classify, and annotate one frame. Returns annotated frame."""
        annotated = frame.copy()
        bbox = detect_traffic_light_bbox(frame)

        if bbox is None:
            cv2.putText(annotated, "No light detected", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (128, 128, 128), 2)
            cv2.imshow("Live feed", _fit(annotated))
            cv2.imshow("Cropped region", np.zeros((60, DISPLAY_W, 3), dtype=np.uint8))
            cv2.imshow("Sections (red | yellow | green)",
                       np.zeros((60, DISPLAY_W * 3, 3), dtype=np.uint8))
            return annotated

        region = crop_bbox(frame, bbox)
        color  = classify_traffic_light_color(region)
        box_c  = BOX_COLOR.get(color, BOX_COLOR["unknown"])

        # Draw detection box and label on the live feed
        x, y, w, h = bbox
        cv2.rectangle(annotated, (x, y), (x + w, y + h), box_c, 2)
        cv2.putText(annotated, color.upper(), (x, max(0, y - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, box_c, 2)

        # Build section strip
        sections     = split_traffic_light_sections(region)
        red_panel    = _resize(sections["red"])
        yellow_panel = _resize(sections["yellow"])
        green_panel  = _resize(sections["green"])
        max_h = max(red_panel.shape[0], yellow_panel.shape[0], green_panel.shape[0])

        def _pad(img: np.ndarray) -> np.ndarray:
            return np.pad(img, ((0, max_h - img.shape[0]), (0, 0), (0, 0)))

        strip = np.hstack([_pad(red_panel), _pad(yellow_panel), _pad(green_panel)])
        cv2.line(strip, (DISPLAY_W, 0),     (DISPLAY_W, max_h),     (255, 255, 255), 1)
        cv2.line(strip, (DISPLAY_W * 2, 0), (DISPLAY_W * 2, max_h), (255, 255, 255), 1)
        for i, label in enumerate(["RED", "YELLOW", "GREEN"]):
            cv2.putText(strip, label, (i * DISPLAY_W + 5, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        region_display = _resize(region.copy())
        cv2.putText(region_display, color.upper(), (5, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        print(f"Detected: {color.upper()}  bbox={bbox}")
        cv2.imshow("Live feed", _fit(annotated))
        cv2.imshow("Cropped region", region_display)
        cv2.imshow("Sections (red | yellow | green)", strip)
        return annotated

    def _resize(img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        new_h = max(1, int(h * DISPLAY_W / max(w, 1)))
        return cv2.resize(img, (DISPLAY_W, new_h))

    def _fit(img: np.ndarray, max_dim: int = 900) -> np.ndarray:
        """Scale image down to fit on screen without distortion."""
        h, w = img.shape[:2]
        scale = min(1.0, max_dim / max(h, w))
        if scale < 1.0:
            return cv2.resize(img, (int(w * scale), int(h * scale)))
        return img

    # --- image ---
    frame = cv2.imread(path)
    if frame is not None:
        _process_frame(frame)
        cv2.waitKey(0)
        cv2.destroyAllWindows()
        sys.exit(0)

    # --- video ---
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print(f"Could not open: {path}")
        sys.exit(1)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        _process_frame(frame)
        if cv2.waitKey(30) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
