import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/summary', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request) => {
    const w = request.workspace!.workspaceId;
    const [services, incidents, spans, deploys] = await Promise.all([
      pool.query(`SELECT count(*)::int count FROM services WHERE workspace_id=$1`, [w]),
      pool.query(`SELECT count(*) FILTER (WHERE status <> 'resolved')::int open,
                         count(*) FILTER (WHERE severity='critical' AND status <> 'resolved')::int critical
                  FROM incidents WHERE workspace_id=$1`, [w]),
      pool.query(`SELECT count(*)::int requests,
                         count(*) FILTER (WHERE status_code='ERROR')::int errors,
                         coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms),0)::float p95
                  FROM spans WHERE workspace_id=$1 AND started_at > now()-interval '1 hour'`, [w]),
      pool.query(`SELECT count(*)::int count FROM deployments WHERE workspace_id=$1 AND deployed_at > now()-interval '24 hours'`, [w]),
    ]);
    const req = spans.rows[0];
    return {
      services: services.rows[0].count,
      openIncidents: incidents.rows[0].open,
      criticalIncidents: incidents.rows[0].critical,
      requestsLastHour: req.requests,
      errorRatePercent: req.requests ? Math.round((req.errors / req.requests) * 10_000) / 100 : 0,
      p95LatencyMs: Math.round(req.p95 * 10) / 10,
      deployments24h: deploys.rows[0].count,
    };
  });

  app.get('/dashboard/latency-series', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request) => {
    const result = await pool.query(
      `SELECT date_trunc('minute', started_at) bucket,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::float p95,
              count(*)::int requests,
              count(*) FILTER (WHERE status_code='ERROR')::int errors
       FROM spans WHERE workspace_id=$1 AND started_at > now()-interval '60 minutes'
       GROUP BY 1 ORDER BY 1`, [request.workspace!.workspaceId],
    );
    return result.rows;
  });
}
