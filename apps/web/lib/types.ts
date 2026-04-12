export type Summary={services:number;openIncidents:number;criticalIncidents:number;requestsLastHour:number;errorRatePercent:number;p95LatencyMs:number;deployments24h:number};
export type Service={id:string;name:string;environment:string;team?:string;requests_15m:number;errors_15m:number;p95_ms:number;error_rate_percent:number;last_seen_at?:string};
export type Incident={id:string;title:string;summary:string;severity:'info'|'warning'|'critical';status:'open'|'acknowledged'|'resolved';source:string;service_name:string;started_at:string;anomaly_score?:number;trace_id?:string;deployment_version?:string};
export type Trace={trace_id:string;started_at:string;ended_at:string;duration_ms:number;span_count:number;has_error:boolean;services:string[]};
