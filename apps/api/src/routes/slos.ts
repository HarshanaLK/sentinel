import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';

const schema=z.object({serviceId:z.string().uuid(),name:z.string().min(1),indicatorType:z.enum(['availability','latency']),objectivePercent:z.number().gt(0).lt(100),windowDays:z.number().int().min(1).max(90).default(30),latencyThresholdMs:z.number().int().positive().optional()});

export async function sloRoutes(app:FastifyInstance){
  app.get('/slos',{preHandler:[app.authenticate,app.requireWorkspace]},async request=>{
    const w=request.workspace!.workspaceId;
    const {rows}=await pool.query(`SELECT slo.*,s.name service_name,
      stats.total,stats.bad,
      CASE WHEN stats.total>0 THEN round(((stats.total-stats.bad)::numeric/stats.total)*100,4) ELSE 100 END achieved_percent
      FROM slos slo JOIN services s ON s.id=slo.service_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int total,
          count(*) FILTER (WHERE CASE WHEN slo.indicator_type='availability' THEN sp.status_code='ERROR' ELSE sp.duration_ms > slo.latency_threshold_ms END)::int bad
        FROM spans sp WHERE sp.workspace_id=slo.workspace_id AND sp.service_id=slo.service_id
          AND sp.started_at > now()-make_interval(days=>slo.window_days)
      ) stats ON true WHERE slo.workspace_id=$1 ORDER BY s.name,slo.name`,[w]);
    return rows.map(r=>{
      const allowedBad=100-Number(r.objective_percent); const actualBad=100-Number(r.achieved_percent);
      return {...r,error_budget_remaining_percent: allowedBad<=0?0:Math.round((1-actualBad/allowedBad)*10000)/100};
    });
  });
  app.post('/slos',{preHandler:[app.authenticate,app.requireWorkspace]},async(request,reply)=>{
    const b=schema.parse(request.body); if(b.indicatorType==='latency'&&!b.latencyThresholdMs)return reply.code(400).send({error:'latency_threshold_required'});
    const {rows}=await pool.query(`INSERT INTO slos(workspace_id,service_id,name,indicator_type,objective_percent,window_days,latency_threshold_ms)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[request.workspace!.workspaceId,b.serviceId,b.name,b.indicatorType,b.objectivePercent,b.windowDays,b.latencyThresholdMs??null]);
    return reply.code(201).send(rows[0]);
  });
}
