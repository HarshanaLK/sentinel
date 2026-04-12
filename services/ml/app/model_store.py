from pathlib import Path
import json
import tensorflow as tf
from .settings import settings

def _safe(key: str) -> str:
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in key)[:180]

def paths(key: str):
    base=Path(settings.model_dir); base.mkdir(parents=True,exist_ok=True)
    safe=_safe(key)
    return base/f"{safe}.keras", base/f"{safe}.json"

def load_model(key: str):
    model_path,meta_path=paths(key)
    if not model_path.exists() or not meta_path.exists(): return None,None
    return tf.keras.models.load_model(model_path), json.loads(meta_path.read_text())

def save_model(key: str, model, meta: dict):
    model_path,meta_path=paths(key); model.save(model_path); meta_path.write_text(json.dumps(meta,indent=2))
