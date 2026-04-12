import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { pool } from '../db.js';
import { hashApiKey } from '../security/api-key.js';

export default fp(async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, { secret: config.JWT_SECRET });

  app.decorate('authenticate', async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const payload = await request.jwtVerify<{ sub: string; email: string; name: string }>();
      request.sessionUser = { userId: payload.sub, email: payload.email, displayName: payload.name };
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.decorate('requireWorkspace', async function requireWorkspace(request: FastifyRequest, reply: FastifyReply) {
    if (!request.sessionUser) return reply.code(401).send({ error: 'unauthorized' });
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') return reply.code(400).send({ error: 'x-workspace-id header is required' });
    const { rows } = await pool.query(
      'SELECT role FROM memberships WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, request.sessionUser.userId],
    );
    if (!rows[0]) return reply.code(403).send({ error: 'workspace_access_denied' });
    request.workspace = { workspaceId, role: rows[0].role };
  });

  app.decorate('authenticateIngestion', async function authenticateIngestion(request: FastifyRequest, reply: FastifyReply) {
    const raw = request.headers['x-api-key'];
    if (typeof raw !== 'string' || !raw.startsWith('snt_')) return reply.code(401).send({ error: 'invalid_api_key' });
    const { rows } = await pool.query(
      `SELECT workspace_id FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
      [hashApiKey(raw)],
    );
    if (!rows[0]) return reply.code(401).send({ error: 'invalid_api_key' });
    request.ingestionWorkspaceId = rows[0].workspace_id;
    await pool.query('UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1', [hashApiKey(raw)]);
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
    requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
    authenticateIngestion: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  }
}
