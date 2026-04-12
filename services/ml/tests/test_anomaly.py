from app.anomaly import robust_score
def test_robust_score_flags_large_spike():
    score,threshold,is_anomaly=robust_score([100,101,99,100,102,98,101,100,800])
    assert score > threshold
    assert is_anomaly
