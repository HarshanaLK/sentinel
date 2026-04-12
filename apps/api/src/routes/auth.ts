import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { verifyPassword } from '../security/password.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash FROM users WHERE lower(email) = lower($1)',
      [body.email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const token = app.jwt.sign({ sub: user.id, email: user.email, name: user.display_name }, { expiresIn: '12h' });
    const workspaces = await pool.query(
      `SELECT w.id, w.slug, w.name, m.role
       FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = $1 ORDER BY w.name`, [user.id],
    );
    return { token, user: { id: user.id, email: user.email, displayName: user.display_name }, workspaces: workspaces.rows };
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const workspaces = await pool.query(
      `SELECT w.id, w.slug, w.name, m.role
       FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = $1 ORDER BY w.name`, [request.sessionUser!.userId],
    );
    return { user: request.sessionUser, workspaces: workspaces.rows };
  });
}
