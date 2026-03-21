"""
Video detection tester — runs the full Detector pipeline on a video file
and displays annotated frames with bounding boxes.

Usage:
    python test_video.py ClearPath_videos/red1.mp4
    python test_video.py ClearPath_videos/red1.mp4 --raw   # bypass all filters
    python test_video.py ClearPath_videos/  # run all videos in folder
"""

import sys
import os
import cv2
from ultralytics import YOLO

from app.core.config import settings
from app.vision.detector import Detector

BOX_COLOR = {
    "red_light":     (0,   0,   255),
    "yellow_light":  (0,   215, 255),
    "green_light":   (0,   200, 0),
    "traffic_light": (128, 128, 128),
    "stop_sign":     (0,   0,   200),
}
DEFAULT_COLOR = (200, 200, 200)


def annotate(frame, detections):
    out = frame.copy()
    for d in detections:
        x, y, w, h = d.bbox
        color = BOX_COLOR.get(d.label, DEFAULT_COLOR)
        cv2.rectangle(out, (x, y), (x + w, y + h), color, 2)
        text = f"{d.label} {d.confidence:.2f}"
        cv2.putText(out, text, (x, max(0, y - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return out


def run_video_raw(path: str):
    """Bypass all filters — show every raw YOLO detection on every frame."""
    model = YOLO(settings.model_path)
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print(f"Could not open: {path}")
        return

    COCO_NAMES = model.names
    total_frames = 0
    print(f"\n=== RAW MODE: {os.path.basename(path)} ===")

    # Save first frame for inspection
    ret, first_frame = cap.read()
    if not ret:
        print("  ERROR: Could not read any frames from video")
        cap.release()
        return
    h0, w0 = first_frame.shape[:2]
    print(f"  Video resolution: {w0}x{h0}")
    save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug_frame.jpg")
    cv2.imwrite(save_path, first_frame)
    print(f"  Saved first frame → {save_path}")
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # rewind

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        total_frames += 1

        results = model(frame, conf=0.20, verbose=False)
        out = frame.copy()

        for box in results[0].boxes:
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            name = COCO_NAMES.get(class_id, str(class_id))
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            # Highlight traffic lights and stop signs in bright colors
            if class_id == 9:
                color = (0, 255, 255)
            elif class_id == 11:
                color = (0, 0, 255)
            else:
                color = (180, 180, 180)

            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.putText(out, f"{name} {conf:.2f}", (x1, max(0, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

            if class_id in (9, 11):
                print(f"  frame {total_frames:04d}: {name} conf={conf:.2f} bbox=[{x1},{y1},{x2-x1},{y2-y1}]")

        h, w = out.shape[:2]
        scale = min(1.0, 900 / max(h, w))
        if scale < 1.0:
            out = cv2.resize(out, (int(w * scale), int(h * scale)))

        cv2.imshow("RAW Detection", out)
        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            break
        if key == ord(' '):
            cv2.waitKey(0)

    cap.release()
    print(f"  Processed {total_frames} frames")


def run_video(path: str, detector: Detector):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print(f"Could not open: {path}")
        return

    total_frames = 0
    detection_frames = 0
    label_counts: dict[str, int] = {}

    print(f"\n=== {os.path.basename(path)} ===")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        total_frames += 1
        detections = detector.detect(frame)

        if detections:
            detection_frames += 1
            for d in detections:
                label_counts[d.label] = label_counts.get(d.label, 0) + 1
            print(f"  frame {total_frames:04d}: {[d.label for d in detections]}")

        annotated = annotate(frame, detections)

        # Fit to screen
        h, w = annotated.shape[:2]
        scale = min(1.0, 900 / max(h, w))
        if scale < 1.0:
            annotated = cv2.resize(annotated, (int(w * scale), int(h * scale)))

        cv2.imshow("Detection", annotated)
        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            break
        if key == ord(' '):  # pause
            cv2.waitKey(0)

    cap.release()

    print(f"  Summary: {detection_frames}/{total_frames} frames had detections")
    for label, count in sorted(label_counts.items()):
        print(f"    {label}: {count} frames")


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_video.py <video_file_or_folder>")
        sys.exit(1)

    detector = Detector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
    )

    raw_mode = "--raw" in sys.argv
    target = sys.argv[1]

    if raw_mode:
        if os.path.isdir(target):
            videos = sorted(
                os.path.join(target, f)
                for f in os.listdir(target)
                if f.endswith(".mp4")
            )
            for v in videos:
                run_video_raw(v)
                if cv2.waitKey(500) & 0xFF == ord('q'):
                    break
        else:
            run_video_raw(target)
        cv2.destroyAllWindows()
        return

    if os.path.isdir(target):
        videos = sorted(
            os.path.join(target, f)
            for f in os.listdir(target)
            if f.endswith(".mp4")
        )
        print(f"Found {len(videos)} videos in {target}")
        for v in videos:
            run_video(v, detector)
            if cv2.waitKey(500) & 0xFF == ord('q'):
                break
    else:
        run_video(target, detector)

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
