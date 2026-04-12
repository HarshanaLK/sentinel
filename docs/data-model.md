# Data model

`workspaces -> services -> metric_samples/log_events/spans/deployments/slos/alert_rules/incidents`

User access is represented by `memberships`. Ingestion credentials live in `api_keys`; only SHA-256 hashes are persisted. Incident state changes append to `incident_events`, preserving an operator timeline. `audit_events` records administrative actions separately from incident history.

Telemetry tables use bigint identity primary keys and composite indexes beginning with workspace/service/time to match the most common access patterns. JSONB is reserved for labels and attributes where schema flexibility is expected.
