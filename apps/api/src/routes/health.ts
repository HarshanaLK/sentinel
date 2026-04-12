import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const started = performance.now();
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'ok', dbLatencyMs: Math.round((performance.now() - started) * 10) / 10 };
  });
}
