import type pg from 'pg';

export async function resolveService(
  client: pg.Pool | pg.PoolClient,
  workspaceId: string,
  name: string,
  environment = 'production',
): Promise<string> {
  const result = await client.query(
    `INSERT INTO services (workspace_id, name, environment)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, name, environment)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [workspaceId, name, environment],
  );
  return result.rows[0].id;
}
