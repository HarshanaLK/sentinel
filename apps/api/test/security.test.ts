import { describe,expect,it } from 'vitest';
import { hashPassword,verifyPassword } from '../src/security/password.js';
import { generateApiKey,hashApiKey } from '../src/security/api-key.js';
describe('security primitives',()=>{
 it('hashes and verifies passwords',async()=>{const h=await hashPassword('CorrectHorseBatteryStaple!');expect(h).not.toContain('CorrectHorse');expect(await verifyPassword('CorrectHorseBatteryStaple!',h)).toBe(true);expect(await verifyPassword('wrong-password',h)).toBe(false);});
 it('never stores raw API keys',()=>{const k=generateApiKey();expect(k.raw.startsWith('snt_')).toBe(true);expect(k.hash).toBe(hashApiKey(k.raw));expect(k.hash).not.toContain(k.raw);});
});
