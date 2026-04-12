# ADR 001 — PostgreSQL for the local telemetry store

**Status:** Accepted

Use PostgreSQL for telemetry in the local/portfolio edition to keep setup understandable and dependency-light. Time-oriented composite indexes and retention procedures make the limits explicit. Revisit when sustained ingestion or query fan-out makes analytical storage materially better.
