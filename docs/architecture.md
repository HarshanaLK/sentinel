# Architecture

## Runtime

```text
Instrumented services / demo generator
             |
      API key / OTLP JSON
             v
      Fastify ingestion API
             |
       PostgreSQL telemetry
             |
     +-------+--------+
     |                |
Incident worker   Query API
     |                |
     v                v
TensorFlow ML     Next.js console
     |
Anomaly scores -> incidents -> timelines / SLOs / traces
```

The local version intentionally uses PostgreSQL for both operational metadata and telemetry. This reduces infrastructure dependencies and makes the repository runnable on a developer laptop without Docker. It is not presented as the final architecture for billions of daily events.

## Boundaries

- **API** owns authentication, tenant authorization, ingestion, query endpoints and operational mutations.
- **Worker** owns recurring rule/SLO/anomaly evaluation and retention.
- **ML service** owns model loading, training and anomaly scoring. The API does not import TensorFlow.
- **Web** uses a server-side session cookie and calls the API from Next.js server components.

## Tenant isolation

Every operational and telemetry table carries `workspace_id`. Console endpoints derive workspace access from authenticated membership. Ingestion endpoints derive it from a hashed API key; clients cannot submit a workspace id in telemetry payloads.

## Incident correlation

When a rule, SLO, or anomaly creates an incident, the worker adds:

1. the most recent deployment for that service within two hours;
2. a recent error trace as an exemplar when one exists;
3. a deterministic fingerprint used to avoid duplicate open incidents.
