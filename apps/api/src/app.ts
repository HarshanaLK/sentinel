import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { serviceRoutes } from './routes/services.js';
import { traceRoutes } from './routes/traces.js';
import { incidentRoutes } from './routes/incidents.js';
import { deploymentRoutes } from './routes/deployments.js';
import { sloRoutes } from './routes/slos.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { otlpRoutes } from './routes/otlp.js';
import { logRoutes } from './routes/logs.js';
import { topologyRoutes } from './routes/topology.js';

export async function buildApp(){
  const app=Fastify({logger:{level:config.NODE_ENV==='development'?'info':'warn'}});
  await app.register(cors,{origin:config.WEB_ORIGIN,credentials:true});
  await app.register(authPlugin);
  await app.register(healthRoutes); await app.register(authRoutes); await app.register(telemetryRoutes); await app.register(otlpRoutes);
  await app.register(dashboardRoutes); await app.register(serviceRoutes); await app.register(traceRoutes); await app.register(logRoutes); await app.register(topologyRoutes);
  await app.register(incidentRoutes); await app.register(deploymentRoutes); await app.register(sloRoutes); await app.register(apiKeyRoutes);
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof ZodError) return reply.code(400).send({error:'validation_error',issues:error.issues});
    app.log.error(error); return reply.code(500).send({error:'internal_error'});
  });
  return app;
}
