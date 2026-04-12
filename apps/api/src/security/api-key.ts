import { createHash, randomBytes } from 'node:crypto';

export function generateApiKey() {
  const raw = `snt_${randomBytes(24).toString('base64url')}`;
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

export function hashApiKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}
