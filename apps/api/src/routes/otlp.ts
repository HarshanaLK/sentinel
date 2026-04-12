import type { FastifyInstance } from 'fastify';
import { withTransaction } from '../db.js';
import { resolveService } from '../services/service-resolver.js';

type OtlpValue={stringValue?:string;intValue?:string|number;doubleValue?:number;boolValue?:boolean};
type OtlpAttr={key:string;value:OtlpValue};
function attrValue(v:OtlpValue):unknown{return v.stringValue??v.intValue??v.doubleValue??v.boolValue??null}
function attrs(list:OtlpAttr[]|undefined){return Object.fromEntries((list??[]).map(a=>[a.key,attrValue(a.value)]))}
function nsToDate(value:string|undefined){if(!value)return new Date();const ms=Number(BigInt(value)/1_000_000n);return new Date(ms)}

export async function otlpRoutes(app:FastifyInstance){
  app.post('/v1/otlp/v1/traces',{preHandler:[app.authenticateIngestion]},async(request,reply)=>{
    const body=request.body as any;const workspaceId=request.ingestionWorkspaceId!;let accepted=0;
    await withTransaction(async client=>{
      for(const resourceSpan of body?.resourceSpans??[]){
        const resource=attrs(resourceSpan.resource?.attributes);const serviceName=String(resource['service.name']??'unknown-service');const environment=String(resource['deployment.environment.name']??resource['deployment.environment']??'production');
        const serviceId=await resolveService(client,workspaceId,serviceName,environment);
        for(const scope of resourceSpan.scopeSpans??resourceSpan.instrumentationLibrarySpans??[]){
          for(const span of scope.spans??[]){
            const started=nsToDate(span.startTimeUnixNano);const ended=nsToDate(span.endTimeUnixNano);const duration=Math.max(0,ended.getTime()-started.getTime());const status=span.status?.code===2?'ERROR':span.status?.code===1?'OK':'UNSET';
            await client.query(`INSERT INTO spans(workspace_id,service_id,trace_id,span_id,parent_span_id,name,kind,duration_ms,status_code,attributes,started_at,ended_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(workspace_id,trace_id,span_id) DO NOTHING`,[workspaceId,serviceId,span.traceId,span.spanId,span.parentSpanId||null,span.name,String(span.kind??'INTERNAL'),duration,status,attrs(span.attributes),started.toISOString(),ended.toISOString()]); accepted++;
          }
        }
      }
    });
    return reply.code(202).send({partialSuccess:{rejectedSpans:0},accepted});
  });
}
