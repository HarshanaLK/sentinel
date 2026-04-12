CREATE INDEX IF NOT EXISTS metric_samples_lookup_idx
    ON metric_samples (workspace_id, service_id, metric_name, observed_at DESC);
CREATE INDEX IF NOT EXISTS metric_samples_time_idx ON metric_samples (observed_at DESC);
CREATE INDEX IF NOT EXISTS log_events_lookup_idx
    ON log_events (workspace_id, service_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS log_events_trace_idx
    ON log_events (workspace_id, trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS spans_trace_idx
    ON spans (workspace_id, trace_id, started_at ASC);
CREATE INDEX IF NOT EXISTS spans_service_time_idx
    ON spans (workspace_id, service_id, started_at DESC);
CREATE INDEX IF NOT EXISTS spans_error_idx
    ON spans (workspace_id, service_id, started_at DESC) WHERE status_code = 'ERROR';
CREATE INDEX IF NOT EXISTS deployments_service_time_idx
    ON deployments (workspace_id, service_id, deployed_at DESC);
CREATE INDEX IF NOT EXISTS incidents_workspace_status_idx
    ON incidents (workspace_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS incident_events_incident_idx
    ON incident_events (incident_id, created_at ASC);
CREATE INDEX IF NOT EXISTS anomaly_eval_lookup_idx
    ON anomaly_evaluations (workspace_id, service_id, metric_name, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_workspace_idx
    ON audit_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS metric_labels_gin_idx ON metric_samples USING gin (labels);
CREATE INDEX IF NOT EXISTS log_attributes_gin_idx ON log_events USING gin (attributes);
CREATE INDEX IF NOT EXISTS span_attributes_gin_idx ON spans USING gin (attributes);
