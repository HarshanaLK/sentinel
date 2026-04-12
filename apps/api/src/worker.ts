import { config } from './config.js';
import { evaluateAnomalies, evaluateRules, evaluateSloBurn } from './jobs/incidents.js';
import { runRetention } from './jobs/retention.js';

let evaluating=false;
async function tick(){ if(evaluating)return; evaluating=true; try{await evaluateRules();await evaluateSloBurn();await evaluateAnomalies();}catch(e){console.error('evaluation tick failed',e);}finally{evaluating=false;} }
await tick(); setInterval(tick,config.ANOMALY_INTERVAL_SECONDS*1000).unref();
await runRetention(); setInterval(()=>runRetention().catch(console.error),config.RETENTION_INTERVAL_MINUTES*60_000).unref();
console.log(`Sentinel worker running; anomaly/rule evaluation every ${config.ANOMALY_INTERVAL_SECONDS}s`);
process.stdin.resume();
