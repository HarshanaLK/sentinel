import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
export async function logRoutes(app:FastifyInstance){
 app.get('/logs',{preHandler:[app.authenticate,app.requireWorkspace]},async request=>{
  const q=request.query as {severity?:string;q?:string;serviceId?:string;limit?:string};const limit=Math.min(Math.max(Number(q.limit??100),1),500);
  const {rows}=await pool.query(`SELECT l.*,s.name service_name FROM log_events l JOIN services s ON s.id=l.service_id
    WHERE l.workspace_id=$1 AND ($2::text IS NULL OR l.severity=$2) AND ($3::uuid IS NULL OR l.service_id=$3)
      AND ($4::text IS NULL OR l.message ILIKE '%'||$4||'%') ORDER BY l.observed_at DESC LIMIT $5`,[request.workspace!.workspaceId,q.severity??null,q.serviceId??null,q.q??null,limit]);return rows;
 });
}
