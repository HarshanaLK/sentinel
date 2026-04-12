# Technical-lead notes

## Why PostgreSQL first?

For a portfolio/local deployment, one durable system makes transactions, tenant isolation, migrations, backup and debugging easy. The schema and code expose the places that would need to change when volume grows. At high cardinality/volume, metrics and traces should move to specialized analytical storage while PostgreSQL remains the control-plane database.

## Cardinality controls

Labels are JSONB for flexibility, but the ingestion API caps batch size and does not dynamically create columns. A production ingestion gateway would also enforce label-key allowlists, per-tenant byte quotas, and service/metric cardinality budgets.

## Model lifecycle

Sentinel never requires a TensorFlow model to start. Before training, robust median/MAD scoring provides a deterministic fallback. A trained autoencoder is stored per service/metric with normalization metadata and a reconstruction-error threshold. Production evolution would add a model registry, versioning, shadow evaluation and drift monitoring.

## Failure modes

- ML unavailable: rules and SLO evaluation continue; anomaly evaluation skips the tick.
- Web unavailable: ingestion and worker continue independently.
- Worker unavailable: telemetry still persists; evaluations resume when it returns.
- PostgreSQL unavailable: ingestion returns failure instead of acknowledging data it did not persist.

## Scale-out path

1. Put an OpenTelemetry Collector tier in front of ingestion.
2. Introduce Kafka for durable buffering and backpressure.
3. Move metrics/traces to ClickHouse/Mimir/Tempo-style specialized stores.
4. Keep PostgreSQL for users, workspaces, SLO definitions, incidents, deployments and audit history.
5. Shard evaluation workers by workspace/service fingerprint.
6. Add notification routing, on-call schedules and escalation policies.

## Security decisions

- Workspace is derived from membership or API key, never trusted from the telemetry body.
- API keys are shown once and stored as hashes.
- Passwords use scrypt with random salts.
- Next.js stores the API JWT in an HttpOnly cookie rather than browser localStorage.
- Role checks protect credential-management actions.
