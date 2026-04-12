export type Role = 'owner' | 'admin' | 'responder' | 'viewer';

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface WorkspaceContext {
  workspaceId: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser?: SessionUser;
    workspace?: WorkspaceContext;
    ingestionWorkspaceId?: string;
  }
}
