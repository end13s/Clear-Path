from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_path: str = "app/models/yolov8.pt"
    confidence_threshold: float = 0.15
    cors_origins: list[str] = ["*"]
    # "right" = drive on the right side of the road (EU/US/Romania).
    # "left"  = drive on the left side of the road (UK/Australia).
    # Controls which horizontal half of the frame is scanned for traffic lights.
    driver_side: str = "right"

    class Config:
        env_file = ".env"


settings = Settings()
