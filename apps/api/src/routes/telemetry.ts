import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTransaction } from '../db.js';
import { resolveService } from '../services/service-resolver.js';

const base = z.object({ service: z.string().min(1).max(120), environment: z.string().min(1).max(50).default('production') });
const metricBatch = z.object({ samples: z.array(base.extend({
  metric: z.string().min(1).max(160), value: z.number().finite(), unit: z.string().max(40).optional(),
  labels: z.record(z.string(), z.unknown()).default({}), observedAt: z.string().datetime().optional(),
})).min(1).max(1000) });
const logBatch = z.object({ events: z.array(base.extend({
  severity: z.enum(['TRACE','DEBUG','INFO','WARN','ERROR','FATAL']), message: z.string().min(1).max(20_000),
  traceId: z.string().max(64).optional(), spanId: z.string().max(32).optional(),
  attributes: z.record(z.string(), z.unknown()).default({}), observedAt: z.string().datetime().optional(),
})).min(1).max(500) });

const deploymentSchema = z.object({ service: z.string().min(1).max(120), environment: z.string().default('production'), version: z.string().min(1).max(100), commitSha: z.string().max(80).optional(), deployedBy: z.string().max(120).optional(), metadata: z.record(z.string(), z.unknown()).default({}), deployedAt: z.string().datetime().optional() });

const spanBatch = z.object({ spans: z.array(base.extend({
  traceId: z.string().min(16).max(64), spanId: z.string().min(8).max(32), parentSpanId: z.string().max(32).optional(),
  name: z.string().min(1).max(240), kind: z.string().max(30).default('INTERNAL'), durationMs: z.number().nonnegative(),
  statusCode: z.enum(['UNSET','OK','ERROR']).default('UNSET'), attributes: z.record(z.string(), z.unknown()).default({}),
  startedAt: z.string().datetime(), endedAt: z.string().datetime(),
})).min(1).max(500) });

export async function telemetryRoutes(app: FastifyInstance) {
  const opts = { preHandler: [app.authenticateIngestion] };

  app.post('/v1/telemetry/metrics', opts, async (request, reply) => {
    const { samples } = metricBatch.parse(request.body);
    const workspaceId = request.ingestionWorkspaceId!;
    await withTransaction(async (client) => {
      const cache = new Map<string, string>();
      for (const sample of samples) {
        const key = `${sample.service}:${sample.environment}`;
        let serviceId = cache.get(key);
        if (!serviceId) { serviceId = await resolveService(client, workspaceId, sample.service, sample.environment); cache.set(key, serviceId); }
        await client.query(
          `INSERT INTO metric_samples (workspace_id, service_id, metric_name, value, unit, labels, observed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [workspaceId, serviceId, sample.metric, sample.value, sample.unit ?? null, sample.labels, sample.observedAt ?? new Date().toISOString()],
        );
      }
    });
    return reply.code(202).send({ accepted: samples.length });
  });

  app.post('/v1/telemetry/logs', opts, async (request, reply) => {
    const { events } = logBatch.parse(request.body);
    const workspaceId = request.ingestionWorkspaceId!;
    await withTransaction(async (client) => {
      const cache = new Map<string, string>();
      for (const event of events) {
        const key = `${event.service}:${event.environment}`;
        let serviceId = cache.get(key);
        if (!serviceId) { serviceId = await resolveService(client, workspaceId, event.service, event.environment); cache.set(key, serviceId); }
        await client.query(
          `INSERT INTO log_events (workspace_id, service_id, trace_id, span_id, severity, message, attributes, observed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [workspaceId, serviceId, event.traceId ?? null, event.spanId ?? null, event.severity, event.message, event.attributes, event.observedAt ?? new Date().toISOString()],
        );
      }
    });
    return reply.code(202).send({ accepted: events.length });
  });

  app.post('/v1/telemetry/spans', opts, async (request, reply) => {
    const { spans } = spanBatch.parse(request.body);
    const workspaceId = request.ingestionWorkspaceId!;
    await withTransaction(async (client) => {
      const cache = new Map<string, string>();
      for (const span of spans) {
        const key = `${span.service}:${span.environment}`;
        let serviceId = cache.get(key);
        if (!serviceId) { serviceId = await resolveService(client, workspaceId, span.service, span.environment); cache.set(key, serviceId); }
        await client.query(
          `INSERT INTO spans (workspace_id, service_id, trace_id, span_id, parent_span_id, name, kind, duration_ms, status_code, attributes, started_at, ended_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (workspace_id, trace_id, span_id) DO NOTHING`,
          [workspaceId, serviceId, span.traceId, span.spanId, span.parentSpanId ?? null, span.name, span.kind, span.durationMs, span.statusCode, span.attributes, span.startedAt, span.endedAt],
        );
      }
    });
    return reply.code(202).send({ accepted: spans.length });
  });

  app.post('/v1/telemetry/deployments', opts, async (request, reply) => {
    const body = deploymentSchema.parse(request.body); const workspaceId = request.ingestionWorkspaceId!;
    await withTransaction(async (client) => {
      const serviceId = await resolveService(client, workspaceId, body.service, body.environment);
      await client.query(`INSERT INTO deployments(workspace_id,service_id,version,commit_sha,environment,deployed_by,metadata,deployed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [workspaceId,serviceId,body.version,body.commitSha??null,body.environment,body.deployedBy??'automation',body.metadata,body.deployedAt??new Date().toISOString()]);
    });
    return reply.code(202).send({accepted:1});
  });

}
