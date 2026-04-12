from __future__ import annotations
import numpy as np
from .model_store import load_model
from .settings import settings

def robust_score(series: list[float]) -> tuple[float,float,bool]:
    values=np.asarray(series,dtype=np.float64)
    history=values[:-1] if len(values)>1 else values
    median=float(np.median(history)); mad=float(np.median(np.abs(history-median)))
    scale=max(1.4826*mad, float(np.std(history))*0.25, 1e-6)
    score=abs(float(values[-1])-median)/scale
    threshold=settings.default_threshold
    return score,threshold,score>=threshold

def model_key(service: str, metric: str) -> str:
    return f"{service}__{metric}"

def score_series(series: list[float], service: str, metric: str):
    model,meta=load_model(model_key(service,metric))
    if model is None:
        score,threshold,is_anomaly=robust_score(series)
        return {"score":score,"threshold":threshold,"isAnomaly":is_anomaly,"method":"robust-mad"}
    window=int(meta["window_size"]); mean=float(meta["mean"]); std=max(float(meta["std"]),1e-6)
    if len(series)<window:
        score,threshold,is_anomaly=robust_score(series)
        return {"score":score,"threshold":threshold,"isAnomaly":is_anomaly,"method":"robust-mad-short-series"}
    x=(np.asarray(series[-window:],dtype=np.float32)-mean)/std
    prediction=model.predict(x.reshape(1,window,1),verbose=0)
    error=float(np.mean(np.square(prediction.reshape(-1)-x)))
    threshold=float(meta["threshold"])
    return {"score":error,"threshold":threshold,"isAnomaly":error>=threshold,"method":"tensorflow-autoencoder"}
