# ADR 002 — Isolate TensorFlow behind an HTTP service

**Status:** Accepted

The Node API/worker sends bounded numeric series to a Python service. This keeps Python ML dependencies out of the operational API process, permits independent model rollout, and allows rule/SLO detection to continue when ML is unavailable.
