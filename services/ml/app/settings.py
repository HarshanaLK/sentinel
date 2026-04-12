from dataclasses import dataclass
import os
from dotenv import load_dotenv
load_dotenv()
@dataclass(frozen=True)
class Settings:
    model_dir: str = os.getenv("MODEL_DIR", "./models")
    default_threshold: float = float(os.getenv("DEFAULT_THRESHOLD", "3.5"))
    window_size: int = int(os.getenv("WINDOW_SIZE", "24"))
    database_url: str = os.getenv("DATABASE_URL", "")
settings = Settings()
