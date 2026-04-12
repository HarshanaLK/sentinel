import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';

export async function incidentRoutes(app: FastifyInstance) {
  app.get('/incidents', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request) => {
    const q = request.query as {status?:string};
    const { rows } = await pool.query(
      `SELECT i.*,s.name service_name,s.environment,d.version deployment_version
       FROM incidents i JOIN services s ON s.id=i.service_id
       LEFT JOIN deployments d ON d.id=i.deployment_id
       WHERE i.workspace_id=$1 AND ($2::text IS NULL OR i.status=$2)
       ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, i.started_at DESC LIMIT 200`,
      [request.workspace!.workspaceId, q.status ?? null],
    );
    return rows;
  });

  app.get('/incidents/:id', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request, reply) => {
    const id=(request.params as {id:string}).id;
    const incident=await pool.query(`SELECT i.*,s.name service_name,d.version deployment_version,d.commit_sha
      FROM incidents i JOIN services s ON s.id=i.service_id LEFT JOIN deployments d ON d.id=i.deployment_id
      WHERE i.id=$1 AND i.workspace_id=$2`,[id,request.workspace!.workspaceId]);
    if(!incident.rows[0]) return reply.code(404).send({error:'incident_not_found'});
    const events=await pool.query(`SELECT e.*,u.display_name actor_name FROM incident_events e LEFT JOIN users u ON u.id=e.actor_user_id
      WHERE e.incident_id=$1 AND e.workspace_id=$2 ORDER BY e.created_at`,[id,request.workspace!.workspaceId]);
    return {incident:incident.rows[0],events:events.rows};
  });

  app.post('/incidents/:id/status', { preHandler: [app.authenticate, app.requireWorkspace] }, async (request, reply) => {
    const id=(request.params as {id:string}).id;
    const {status,note}=z.object({status:z.enum(['acknowledged','resolved']),note:z.string().max(1000).optional()}).parse(request.body);
    const w=request.workspace!.workspaceId;
    const updated=await withTransaction(async client=>{
      const r=await client.query(`UPDATE incidents SET status=$1,
        acknowledged_at=CASE WHEN $1='acknowledged' THEN coalesce(acknowledged_at,now()) ELSE acknowledged_at END,
        resolved_at=CASE WHEN $1='resolved' THEN now() ELSE NULL END, updated_at=now()
        WHERE id=$2 AND workspace_id=$3 RETURNING *`,[status,id,w]);
      if(!r.rows[0]) return null;
      await client.query(`INSERT INTO incident_events(workspace_id,incident_id,event_type,message,actor_user_id)
        VALUES($1,$2,$3,$4,$5)`,[w,id,status,note ?? `Incident ${status}`,request.sessionUser!.userId]);
      await client.query(`INSERT INTO audit_events(workspace_id,user_id,action,entity_type,entity_id)
        VALUES($1,$2,$3,'incident',$4)`,[w,request.sessionUser!.userId,`incident.${status}`,id]);
      return r.rows[0];
    });
    if(!updated) return reply.code(404).send({error:'incident_not_found'});
    return updated;
  });
}
