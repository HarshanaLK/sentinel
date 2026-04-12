import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  ML_SERVICE_URL: z.string().url().default('http://127.0.0.1:8100'),
  ANOMALY_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(30),
  RETENTION_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(60),
  METRIC_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
  SPAN_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
});

export const config = schema.parse(process.env);
