import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function traceRoutes(app: FastifyInstance) {
  app.get('/traces', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request) => {
    const query = request.query as { limit?: string; errorsOnly?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
    const errors = query.errorsOnly === 'true';
    const { rows } = await pool.query(
      `SELECT trace_id,
              min(started_at) started_at,
              max(ended_at) ended_at,
              extract(epoch FROM (max(ended_at)-min(started_at)))*1000 duration_ms,
              count(*)::int span_count,
              bool_or(status_code='ERROR') has_error,
              array_agg(DISTINCT s.name) services
       FROM spans sp JOIN services s ON s.id=sp.service_id
       WHERE sp.workspace_id=$1 ${errors ? "AND EXISTS (SELECT 1 FROM spans e WHERE e.workspace_id=sp.workspace_id AND e.trace_id=sp.trace_id AND e.status_code='ERROR')" : ''}
       GROUP BY trace_id ORDER BY started_at DESC LIMIT $2`, [request.workspace!.workspaceId, limit],
    );
    return rows;
  });

  app.get('/traces/:traceId', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request, reply) => {
    const traceId = (request.params as {traceId:string}).traceId;
    const [spans, logs] = await Promise.all([
      pool.query(`SELECT sp.*,s.name service_name,s.environment FROM spans sp JOIN services s ON s.id=sp.service_id
                  WHERE sp.workspace_id=$1 AND sp.trace_id=$2 ORDER BY sp.started_at`, [request.workspace!.workspaceId,traceId]),
      pool.query(`SELECT l.*,s.name service_name FROM log_events l JOIN services s ON s.id=l.service_id
                  WHERE l.workspace_id=$1 AND l.trace_id=$2 ORDER BY l.observed_at`, [request.workspace!.workspaceId,traceId]),
    ]);
    if (!spans.rows.length) return reply.code(404).send({error:'trace_not_found'});
    return { traceId, spans: spans.rows, logs: logs.rows };
  });
}
