import type { FastifyInstance } from 'fastify';import{pool}from'../db.js';
export async function topologyRoutes(app:FastifyInstance){app.get('/topology',{preHandler:[app.authenticate,app.requireWorkspace]},async request=>{const{rows}=await pool.query(`SELECT parent_service.name source, child_service.name target,count(*)::int calls,
 count(*) FILTER(WHERE child.status_code='ERROR')::int errors,avg(child.duration_ms)::float avg_duration_ms
 FROM spans child JOIN spans parent ON parent.workspace_id=child.workspace_id AND parent.trace_id=child.trace_id AND parent.span_id=child.parent_span_id
 JOIN services parent_service ON parent_service.id=parent.service_id JOIN services child_service ON child_service.id=child.service_id
 WHERE child.workspace_id=$1 AND child.started_at>now()-interval '1 hour' AND parent.service_id<>child.service_id
 GROUP BY parent_service.name,child_service.name ORDER BY calls DESC`,[request.workspace!.workspaceId]);return rows.map(r=>({...r,error_rate_percent:r.calls?Math.round((r.errors/r.calls)*10000)/100:0}));});}
