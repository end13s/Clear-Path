from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_path: str = "app/models/yolov8_traffic.pt"
    confidence_threshold: float = 0.5
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
