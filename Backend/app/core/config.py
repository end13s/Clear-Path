from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # Stock COCO YOLOv8n; Ultralytics downloads it on first run if missing.
    model_path: str = "yolov8n.pt"
    confidence_threshold: float = 0.15
    cors_origins: list[str] = ["*"]
    # "right" = drive on the right side of the road (EU/US/Romania).
    # "left"  = drive on the left side of the road (UK/Australia).
    # Controls which horizontal half of the frame is scanned for traffic lights.
    driver_side: str = "right"


settings = Settings()
