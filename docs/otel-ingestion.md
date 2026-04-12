# OpenTelemetry trace ingestion

Sentinel exposes a lightweight OTLP/HTTP JSON-compatible trace endpoint:

```text
POST /v1/otlp/v1/traces
x-api-key: snt_...
content-type: application/json
```

The adapter reads `resourceSpans`, extracts `service.name` and deployment environment resource attributes, then normalizes spans into Sentinel's relational trace model.

The purpose is to demonstrate the collector boundary. A larger deployment would normally place an OpenTelemetry Collector in front of storage so sampling, batching, tail policies and protocol translation happen outside the product API. OpenTelemetry is designed around vendor-neutral traces, metrics and logs, making that migration path straightforward.
