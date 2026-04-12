import { createHash } from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';

function compare(value:number,operator:string,threshold:number){
  return operator==='gt'?value>threshold:operator==='gte'?value>=threshold:operator==='lt'?value<threshold:value<=threshold;
}
function fingerprint(parts:string[]){return createHash('sha256').update(parts.join('|')).digest('hex');}

async function nearestDeployment(workspaceId:string,serviceId:string){
  const {rows}=await pool.query(`SELECT id FROM deployments WHERE workspace_id=$1 AND service_id=$2 AND deployed_at>now()-interval '2 hours' ORDER BY deployed_at DESC LIMIT 1`,[workspaceId,serviceId]); return rows[0]?.id??null;
}
async function exemplarTrace(workspaceId:string,serviceId:string){
  const {rows}=await pool.query(`SELECT trace_id FROM spans WHERE workspace_id=$1 AND service_id=$2 AND status_code='ERROR' AND started_at>now()-interval '30 minutes' ORDER BY duration_ms DESC LIMIT 1`,[workspaceId,serviceId]); return rows[0]?.trace_id??null;
}
async function upsertIncident(input:{workspaceId:string;serviceId:string;title:string;summary:string;severity:string;source:string;fingerprint:string;anomalyScore?:number}){
  const dep=await nearestDeployment(input.workspaceId,input.serviceId); const trace=await exemplarTrace(input.workspaceId,input.serviceId);
  const {rows}=await pool.query(`INSERT INTO incidents(workspace_id,service_id,title,summary,severity,source,fingerprint,anomaly_score,trace_id,deployment_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (workspace_id,fingerprint) WHERE status<>'resolved' DO UPDATE SET summary=EXCLUDED.summary,severity=EXCLUDED.severity,updated_at=now()
    RETURNING id,(xmax=0) created`,[input.workspaceId,input.serviceId,input.title,input.summary,input.severity,input.source,input.fingerprint,input.anomalyScore??null,trace,dep]);
  const incident=rows[0];
  if(incident?.created) await pool.query(`INSERT INTO incident_events(workspace_id,incident_id,event_type,message,metadata) VALUES($1,$2,'opened',$3,$4)`,[input.workspaceId,incident.id,'Incident opened by evaluation worker',{source:input.source}]);
}

export async function evaluateRules(){
  const {rows:rules}=await pool.query(`SELECT r.*,s.name service_name FROM alert_rules r JOIN services s ON s.id=r.service_id WHERE r.enabled=true`);
  for(const rule of rules){
    const agg=rule.aggregation; // safe: DB CHECK restricts this value
    const {rows}=await pool.query(`SELECT ${agg}(value)::float value FROM metric_samples WHERE workspace_id=$1 AND service_id=$2 AND metric_name=$3 AND observed_at>now()-make_interval(mins=>$4)`,[rule.workspace_id,rule.service_id,rule.metric_name,rule.window_minutes]);
    const value=rows[0]?.value; if(value==null||!compare(value,rule.operator,rule.threshold)) continue;
    const fp=fingerprint(['rule',rule.id]);
    await upsertIncident({workspaceId:rule.workspace_id,serviceId:rule.service_id,title:`${rule.name} on ${rule.service_name}`,summary:`${rule.aggregation} ${rule.metric_name}=${Number(value).toFixed(2)} breached ${rule.operator} ${rule.threshold} over ${rule.window_minutes}m`,severity:rule.severity,source:'rule',fingerprint:fp});
  }
}

export async function evaluateAnomalies(){
  const {rows:series}=await pool.query(`SELECT m.workspace_id,m.service_id,m.metric_name,s.name service_name,array_agg(m.value ORDER BY m.observed_at) values
    FROM (SELECT * FROM metric_samples WHERE observed_at>now()-interval '2 hours' ORDER BY observed_at DESC LIMIT 50000) m
    JOIN services s ON s.id=m.service_id GROUP BY m.workspace_id,m.service_id,m.metric_name,s.name HAVING count(*)>=24`);
  for(const item of series){
    const values=(item.values as number[]).slice(-60);
    try{
      const response=await fetch(`${config.ML_SERVICE_URL}/score`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({series:values,metric:item.metric_name,service:item.service_name})});
      if(!response.ok) continue; const score=await response.json() as {score:number;threshold:number;isAnomaly:boolean;method:string};
      await pool.query(`INSERT INTO anomaly_evaluations(workspace_id,service_id,metric_name,score,threshold,is_anomaly,method) VALUES($1,$2,$3,$4,$5,$6,$7)`,[item.workspace_id,item.service_id,item.metric_name,score.score,score.threshold,score.isAnomaly,score.method]);
      if(score.isAnomaly){const fp=fingerprint(['anomaly',item.service_id,item.metric_name]);await upsertIncident({workspaceId:item.workspace_id,serviceId:item.service_id,title:`Anomalous ${item.metric_name} on ${item.service_name}`,summary:`Anomaly score ${score.score.toFixed(3)} exceeded threshold ${score.threshold.toFixed(3)} (${score.method})`,severity:score.score>score.threshold*1.5?'critical':'warning',source:'anomaly',fingerprint:fp,anomalyScore:score.score});}
    }catch(error){console.warn('ML scoring unavailable',error instanceof Error?error.message:error);}
  }
}


export async function evaluateSloBurn(){
  const {rows:slos}=await pool.query(`SELECT slo.*,s.name service_name FROM slos slo JOIN services s ON s.id=slo.service_id`);
  for(const slo of slos){
    const {rows}=await pool.query(`SELECT count(*)::int total,
      count(*) FILTER(WHERE CASE WHEN $3='availability' THEN status_code='ERROR' ELSE duration_ms>$4 END)::int bad
      FROM spans WHERE workspace_id=$1 AND service_id=$2 AND started_at>now()-interval '15 minutes'`,[slo.workspace_id,slo.service_id,slo.indicator_type,slo.latency_threshold_ms]);
    const {total,bad}=rows[0]; if(total<20)continue; const achieved=((total-bad)/total)*100;
    if(achieved<Number(slo.objective_percent)){
      const fp=fingerprint(['slo',slo.id]);
      await upsertIncident({workspaceId:slo.workspace_id,serviceId:slo.service_id,title:`SLO burn on ${slo.service_name}`,summary:`${slo.name} achieved ${achieved.toFixed(3)}% over the last 15m, below ${slo.objective_percent}% objective`,severity:achieved<Number(slo.objective_percent)-2?'critical':'warning',source:'slo',fingerprint:fp});
    }
  }
}
