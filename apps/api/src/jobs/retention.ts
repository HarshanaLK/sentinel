import { pool } from '../db.js';
import { config } from '../config.js';
export async function runRetention(){
  const {rows}=await pool.query('SELECT * FROM delete_expired_telemetry($1,$2,$3)',[config.METRIC_RETENTION_DAYS,config.LOG_RETENTION_DAYS,config.SPAN_RETENTION_DAYS]);
  console.log('retention',rows[0]);
}
