from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import detection, health, demo
from app.core.config import settings

app = FastAPI(title="Clear-Path API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(detection.router, prefix="/detect", tags=["detection"])
app.include_router(demo.router, prefix="/demo", tags=["demo"])

_videos_dir = Path(__file__).parent.parent / "ClearPath_videos"
if _videos_dir.exists():
    app.mount("/videos", StaticFiles(directory=str(_videos_dir)), name="videos")
