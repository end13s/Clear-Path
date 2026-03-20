# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clear-Path backend — helps elderly drivers by detecting traffic signs and lights in real-time using YOLOv8 + OpenCV, served via FastAPI.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --reload

# Run all tests
pytest

# Run a single test file
pytest tests/test_api/test_detection.py

# Test the detector standalone (pass an image path)
python -m app.vision.detector path/to/image.jpg
```

## Architecture

The codebase is split into two clean domains:

- **`app/api/`** — FastAPI routes and dependency injection. `dependencies.py` exposes `get_detector()` which loads a singleton `Detector`. The `/detect/frame` endpoint accepts a multipart image upload.
- **`app/core/`** — Shared config (`config.py` reads from `.env`) and Pydantic schemas (`schemas.py`). `Detection` and `DetectionResponse` are the contract between the API and vision layers.
- **`app/vision/`** — All computer vision logic. `detector.py` is the main entry point: it preprocesses the frame, runs YOLOv8, then postprocesses results into `Detection` objects. `labels.py` maps YOLO class IDs to human-readable labels and severity levels.
- **`app/models/`** — Gitignored directory where `.pt` weight files live.

## Key Boundary

`Detector.detect(frame: np.ndarray) -> list[Detection]` in `app/vision/detector.py` is the interface between the two developers. The API layer only calls this method — it never touches YOLO or OpenCV directly.

## Adding New Traffic Sign Classes

1. Update `app/vision/labels.py` — add the class index → `(label, severity)` mapping.
2. Retrain or swap the model at `MODEL_PATH`.
3. No changes needed in the API layer.
