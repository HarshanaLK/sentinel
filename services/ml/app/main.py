from fastapi import FastAPI
from .schemas import ScoreRequest,ScoreResponse,TrainRequest,TrainResponse
from .anomaly import score_series
from .training import train
app=FastAPI(title="Sentinel Anomaly Service",version="1.0.0")
@app.get("/health")
def health(): return {"status":"ok","engine":"tensorflow"}
@app.post("/score",response_model=ScoreResponse)
def score(req:ScoreRequest): return score_series(req.series,req.service,req.metric)
@app.post("/train",response_model=TrainResponse)
def train_model(req:TrainRequest): return train(req.series,req.modelKey,req.epochs)
