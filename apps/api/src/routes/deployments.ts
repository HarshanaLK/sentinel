import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';

const createSchema=z.object({serviceId:z.string().uuid(),version:z.string().min(1).max(100),commitSha:z.string().max(80).optional(),environment:z.string().default('production'),deployedBy:z.string().max(120).optional(),metadata:z.record(z.string(),z.unknown()).default({})});

export async function deploymentRoutes(app:FastifyInstance){
  app.get('/deployments',{preHandler:[app.authenticate,app.requireWorkspace]},async request=>{
    const {rows}=await pool.query(`SELECT d.*,s.name service_name FROM deployments d JOIN services s ON s.id=d.service_id
      WHERE d.workspace_id=$1 ORDER BY d.deployed_at DESC LIMIT 100`,[request.workspace!.workspaceId]); return rows;
  });
  app.post('/deployments',{preHandler:[app.authenticate,app.requireWorkspace]},async(request,reply)=>{
    const b=createSchema.parse(request.body); const w=request.workspace!.workspaceId;
    const exists=await pool.query(`SELECT 1 FROM services WHERE id=$1 AND workspace_id=$2`,[b.serviceId,w]);
    if(!exists.rows[0]) return reply.code(404).send({error:'service_not_found'});
    const {rows}=await pool.query(`INSERT INTO deployments(workspace_id,service_id,version,commit_sha,environment,deployed_by,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[w,b.serviceId,b.version,b.commitSha??null,b.environment,b.deployedBy??request.sessionUser!.displayName,b.metadata]);
    return reply.code(201).send(rows[0]);
  });
}
