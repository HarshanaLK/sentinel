import {randomBytes} from 'node:crypto';
const base=process.env.SENTINEL_API_URL??'http://127.0.0.1:4000';const key=process.env.SENTINEL_API_KEY;if(!key)throw new Error('Set SENTINEL_API_KEY to the key printed by the seed command.');
const services=['api-gateway','identity-service','catalog-service','checkout-service'];
function id(bytes:number){return randomBytes(bytes).toString('hex')}
function gaussian(mean:number,sd:number){const u=Math.max(Math.random(),1e-9),v=Math.max(Math.random(),1e-9);return mean+Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*sd}
async function post(path:string,body:unknown){const r=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json','x-api-key':key!},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${path} ${r.status} ${await r.text()}`)}
async function emit(iteration:number){const now=Date.now();const trace=id(16);const spike=iteration>35&&iteration<50;const failing=spike&&Math.random()<0.32;const rootDuration=Math.max(20,gaussian(spike?1150:220,spike?180:55));const checkout=rootDuration*.62;const catalog=Math.max(12,gaussian(70,20));const identity=Math.max(8,gaussian(35,10));const rootSpan=id(8),identitySpan=id(8),catalogSpan=id(8),checkoutSpan=id(8);const start=new Date(now-rootDuration);
 const spans=[
  {service:'api-gateway',traceId:trace,spanId:rootSpan,name:'POST /checkout',kind:'SERVER',durationMs:rootDuration,statusCode:failing?'ERROR':'OK',startedAt:start.toISOString(),endedAt:new Date(now).toISOString(),attributes:{'http.request.method':'POST','http.route':'/checkout'}},
  {service:'identity-service',traceId:trace,spanId:identitySpan,parentSpanId:rootSpan,name:'verify-session',kind:'CLIENT',durationMs:identity,statusCode:'OK',startedAt:new Date(start.getTime()+8).toISOString(),endedAt:new Date(start.getTime()+8+identity).toISOString(),attributes:{}},
  {service:'catalog-service',traceId:trace,spanId:catalogSpan,parentSpanId:rootSpan,name:'reserve-items',kind:'CLIENT',durationMs:catalog,statusCode:'OK',startedAt:new Date(start.getTime()+50).toISOString(),endedAt:new Date(start.getTime()+50+catalog).toISOString(),attributes:{}},
  {service:'checkout-service',traceId:trace,spanId:checkoutSpan,parentSpanId:rootSpan,name:'charge-and-create-order',kind:'CLIENT',durationMs:checkout,statusCode:failing?'ERROR':'OK',startedAt:new Date(start.getTime()+120).toISOString(),endedAt:new Date(Math.min(now,start.getTime()+120+checkout)).toISOString(),attributes:{'db.system':'postgresql','payment.provider':'sandbox'}},
 ];
 await post('/v1/telemetry/spans',{spans});
 await post('/v1/telemetry/metrics',{samples:services.map(service=>({service,metric:'http.server.duration.p95',value:service==='checkout-service'?checkout:service==='api-gateway'?rootDuration:service==='catalog-service'?catalog:identity,unit:'ms',labels:{route:service==='api-gateway'?'/checkout':'internal'}}))});
 const events=[{service:'api-gateway',severity:'INFO',message:`checkout request ${failing?'failed':'completed'}`,traceId:trace,spanId:rootSpan,attributes:{requestId:id(8)}}];
 if(failing)events.push({service:'checkout-service',severity:'ERROR',message:'payment provider timeout while creating order',traceId:trace,spanId:checkoutSpan,attributes:{timeoutMs:900}} as any);
 await post('/v1/telemetry/logs',{events});
 if(iteration===32)await post('/v1/telemetry/deployments',{service:'checkout-service',version:'2026.10.2-rc.4',commitSha:'9c2edb16f88d1c2a',deployedBy:'github-actions',metadata:{change:'payment retry policy'}});
}
console.log('Generating 90 telemetry intervals. A latency spike is injected after interval 35.');for(let i=0;i<90;i++){await emit(i);if(i%10===0)console.log(`interval ${i}/90`);await new Promise(r=>setTimeout(r,400));}console.log('Done. Leave the incident worker running for anomaly/rule evaluation.');
