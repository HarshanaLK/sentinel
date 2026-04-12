CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'responder', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    scopes text[] NOT NULL DEFAULT ARRAY['telemetry:write']::text[],
    last_used_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    environment text NOT NULL DEFAULT 'production',
    team text,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name, environment)
);

CREATE TABLE IF NOT EXISTS metric_samples (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    metric_name text NOT NULL,
    value double precision NOT NULL,
    unit text,
    labels jsonb NOT NULL DEFAULT '{}'::jsonb,
    observed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS log_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    trace_id text,
    span_id text,
    severity text NOT NULL CHECK (severity IN ('TRACE','DEBUG','INFO','WARN','ERROR','FATAL')),
    message text NOT NULL,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    observed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS spans (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    trace_id text NOT NULL,
    span_id text NOT NULL,
    parent_span_id text,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'INTERNAL',
    duration_ms double precision NOT NULL CHECK (duration_ms >= 0),
    status_code text NOT NULL DEFAULT 'UNSET' CHECK (status_code IN ('UNSET','OK','ERROR')),
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL,
    ended_at timestamptz NOT NULL,
    UNIQUE (workspace_id, trace_id, span_id)
);

CREATE TABLE IF NOT EXISTS deployments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    version text NOT NULL,
    commit_sha text,
    environment text NOT NULL,
    deployed_by text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    deployed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name text NOT NULL,
    indicator_type text NOT NULL CHECK (indicator_type IN ('availability','latency')),
    objective_percent numeric(6,3) NOT NULL CHECK (objective_percent > 0 AND objective_percent < 100),
    window_days integer NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 90),
    latency_threshold_ms integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, service_id, name)
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name text NOT NULL,
    metric_name text NOT NULL,
    aggregation text NOT NULL DEFAULT 'avg' CHECK (aggregation IN ('avg','max','min','sum')),
    operator text NOT NULL CHECK (operator IN ('gt','gte','lt','lte')),
    threshold double precision NOT NULL,
    window_minutes integer NOT NULL DEFAULT 5 CHECK (window_minutes BETWEEN 1 AND 1440),
    severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, service_id, name)
);

CREATE TABLE IF NOT EXISTS incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title text NOT NULL,
    summary text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    source text NOT NULL CHECK (source IN ('rule','anomaly','slo','manual')),
    fingerprint text NOT NULL,
    anomaly_score double precision,
    trace_id text,
    deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS incidents_open_fingerprint_unique
ON incidents (workspace_id, fingerprint)
WHERE status <> 'resolved';

CREATE TABLE IF NOT EXISTS incident_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    message text NOT NULL,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_evaluations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    metric_name text NOT NULL,
    score double precision NOT NULL,
    threshold double precision NOT NULL,
    is_anomaly boolean NOT NULL,
    method text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
