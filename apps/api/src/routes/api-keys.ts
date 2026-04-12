import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { generateApiKey } from '../security/api-key.js';

export async function apiKeyRoutes(app:FastifyInstance){
  app.get('/api-keys',{preHandler:[app.authenticate,app.requireWorkspace]},async request=>{
    const {rows}=await pool.query(`SELECT id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at FROM api_keys WHERE workspace_id=$1 ORDER BY created_at DESC`,[request.workspace!.workspaceId]);return rows;
  });
  app.post('/api-keys',{preHandler:[app.authenticate,app.requireWorkspace]},async(request,reply)=>{
    if(!['owner','admin'].includes(request.workspace!.role)) return reply.code(403).send({error:'insufficient_role'});
    const b=z.object({name:z.string().min(2).max(100)}).parse(request.body); const key=generateApiKey();
    const {rows}=await pool.query(`INSERT INTO api_keys(workspace_id,name,key_prefix,key_hash) VALUES($1,$2,$3,$4) RETURNING id,name,key_prefix,created_at`,[request.workspace!.workspaceId,b.name,key.prefix,key.hash]);
    return reply.code(201).send({...rows[0],key:key.raw});
  });
  app.delete('/api-keys/:id',{preHandler:[app.authenticate,app.requireWorkspace]},async(request,reply)=>{
    if(!['owner','admin'].includes(request.workspace!.role)) return reply.code(403).send({error:'insufficient_role'});
    const id=(request.params as {id:string}).id; await pool.query(`UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND workspace_id=$2`,[id,request.workspace!.workspaceId]); return reply.code(204).send();
  });
}
