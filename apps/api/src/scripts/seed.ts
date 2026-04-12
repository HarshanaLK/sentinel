import { pool } from '../db.js';
import { hashPassword } from '../security/password.js';
import { generateApiKey } from '../security/api-key.js';

const email='owner@sentinel.local', password='Sentinel123!';
const pass=await hashPassword(password);
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const user=(await client.query(`INSERT INTO users(email,display_name,password_hash) VALUES($1,'Alex Morgan',$2)
  ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name, password_hash=EXCLUDED.password_hash RETURNING id`,[email,pass])).rows[0];
 const ws=(await client.query(`INSERT INTO workspaces(slug,name) VALUES('acme-platform','Acme Platform') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`)).rows[0];
 await client.query(`INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner') ON CONFLICT DO NOTHING`,[ws.id,user.id]);
 const key=generateApiKey();
 await client.query(`DELETE FROM api_keys WHERE workspace_id=$1 AND name='Local telemetry generator'`,[ws.id]);
 await client.query(`INSERT INTO api_keys(workspace_id,name,key_prefix,key_hash) VALUES($1,'Local telemetry generator',$2,$3)`,[ws.id,key.prefix,key.hash]);
 for(const s of [['api-gateway','edge'],['checkout-service','payments'],['catalog-service','commerce'],['identity-service','platform']]){
   await client.query(`INSERT INTO services(workspace_id,name,environment,team) VALUES($1,$2,'production',$3) ON CONFLICT(workspace_id,name,environment) DO UPDATE SET team=EXCLUDED.team`,[ws.id,s[0],s[1]]);
 }
 const services=await client.query(`SELECT id,name FROM services WHERE workspace_id=$1`,[ws.id]); const byName=Object.fromEntries(services.rows.map(r=>[r.name,r.id]));
 await client.query(`INSERT INTO alert_rules(workspace_id,service_id,name,metric_name,aggregation,operator,threshold,window_minutes,severity)
   VALUES($1,$2,'Checkout p95 latency','http.server.duration.p95','avg','gt',800,5,'critical') ON CONFLICT(workspace_id,service_id,name) DO NOTHING`,[ws.id,byName['checkout-service']]);
 await client.query(`INSERT INTO slos(workspace_id,service_id,name,indicator_type,objective_percent,window_days)
   VALUES($1,$2,'Checkout availability','availability',99.9,30) ON CONFLICT DO NOTHING`,[ws.id,byName['checkout-service']]);
 await client.query(`INSERT INTO slos(workspace_id,service_id,name,indicator_type,objective_percent,window_days,latency_threshold_ms)
   VALUES($1,$2,'Gateway latency','latency',99.0,30,500) ON CONFLICT DO NOTHING`,[ws.id,byName['api-gateway']]);
 await client.query('COMMIT');
 console.log('\nSeed complete');console.log(`Email: ${email}`);console.log(`Password: ${password}`);console.log(`Workspace ID: ${ws.id}`);console.log(`Telemetry API key: ${key.raw}\n`);
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
