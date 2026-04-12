import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function serviceRoutes(app: FastifyInstance) {
  app.get('/services', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request) => {
    const { rows } = await pool.query(
      `SELECT s.id,s.name,s.environment,s.team,
              count(sp.id) FILTER (WHERE sp.started_at > now()-interval '15 minutes')::int requests_15m,
              count(sp.id) FILTER (WHERE sp.started_at > now()-interval '15 minutes' AND sp.status_code='ERROR')::int errors_15m,
              coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY sp.duration_ms)
                FILTER (WHERE sp.started_at > now()-interval '15 minutes'),0)::float p95_ms,
              max(sp.started_at) last_seen_at
       FROM services s LEFT JOIN spans sp ON sp.service_id=s.id AND sp.workspace_id=s.workspace_id
       WHERE s.workspace_id=$1 GROUP BY s.id ORDER BY s.name`, [request.workspace!.workspaceId],
    );
    return rows.map(r => ({...r, error_rate_percent: r.requests_15m ? Math.round((r.errors_15m/r.requests_15m)*10000)/100 : 0}));
  });

  app.get('/services/:id', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request, reply) => {
    const id = (request.params as {id:string}).id;
    const { rows } = await pool.query(
      `SELECT * FROM services WHERE id=$1 AND workspace_id=$2`, [id, request.workspace!.workspaceId],
    );
    if (!rows[0]) return reply.code(404).send({error:'service_not_found'});
    const metrics = await pool.query(
      `SELECT metric_name, max(observed_at) last_seen, count(*)::int samples
       FROM metric_samples WHERE workspace_id=$1 AND service_id=$2 AND observed_at>now()-interval '24 hours'
       GROUP BY metric_name ORDER BY metric_name`, [request.workspace!.workspaceId,id]);
    const deployment = await pool.query(
      `SELECT * FROM deployments WHERE workspace_id=$1 AND service_id=$2 ORDER BY deployed_at DESC LIMIT 1`, [request.workspace!.workspaceId,id]);
    return {service: rows[0], metrics: metrics.rows, latestDeployment: deployment.rows[0] ?? null};
  });
}
