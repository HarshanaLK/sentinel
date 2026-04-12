from pydantic import BaseModel, Field
class ScoreRequest(BaseModel):
    series: list[float] = Field(min_length=8, max_length=1000)
    metric: str = "unknown"
    service: str = "unknown"
class ScoreResponse(BaseModel):
    score: float
    threshold: float
    isAnomaly: bool
    method: str
class TrainRequest(BaseModel):
    series: list[float] = Field(min_length=64, max_length=200_000)
    modelKey: str
    epochs: int = Field(default=20, ge=1, le=200)
class TrainResponse(BaseModel):
    modelKey: str
    windows: int
    threshold: float
    finalLoss: float
