import threading
from pathlib import Path

import cv2
import numpy as np

VIDEO_DIR = Path(__file__).parent.parent.parent / "ClearPath_videos"


class VideoStreamer:
    """Serves video frames one at a time for the demo endpoint.
    Loops the video when it reaches the end.
    Switches source file automatically when a different video is requested.
    Thread-safe via a lock."""

    def __init__(self):
        self._cap: cv2.VideoCapture | None = None
        self._current_video: str | None = None
        self._lock = threading.Lock()

    def get_frame(self, video_name: str) -> np.ndarray | None:
        with self._lock:
            path = str(VIDEO_DIR / video_name)

            # Switch video if requested file changed
            if video_name != self._current_video:
                if self._cap:
                    self._cap.release()
                self._cap = cv2.VideoCapture(path)
                self._current_video = video_name

            if not self._cap or not self._cap.isOpened():
                return None

            ret, frame = self._cap.read()
            if not ret:
                # Loop back to beginning
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._cap.read()

            return frame if ret else None

    def get_frame_at(self, video_name: str, position_ms: int) -> np.ndarray | None:
        """Return the frame closest to position_ms in the video.
        Used for position-synced detection alongside a native video player."""
        with self._lock:
            path = str(VIDEO_DIR / video_name)

            if video_name != self._current_video:
                if self._cap:
                    self._cap.release()
                self._cap = cv2.VideoCapture(path)
                self._current_video = video_name

            if not self._cap or not self._cap.isOpened():
                return None

            fps = self._cap.get(cv2.CAP_PROP_FPS) or 30.0
            target_frame = int(position_ms / 1000.0 * fps)
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ret, frame = self._cap.read()
            return frame if ret else None

    def available_videos(self) -> list[str]:
        files = [p.name for p in VIDEO_DIR.iterdir() if p.suffix.lower() in (".mp4", ".mov")]
        return sorted(files)

    def release(self):
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self._current_video = None
