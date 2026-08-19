import * as argon2 from 'argon2';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadConfiguration } from '../../config/env.ts';

/**
 * Argon2id password hashing.
 *
 * Parameters follow the current OWASP Password Storage Cheat Sheet:
 * memoryCost 19 MiB, timeCost 2, parallelism 1. On top of the per-user salt
 * (handled by argon2 itself) we apply a server-side pepper via HMAC-SHA256
 * before hashing. A stolen database without the pepper from .env is
 * therefore not enough to mount an offline attack.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies Parameters<typeof argon2.hash>[1];

function peppered(plain: string): string {
  const pepper = loadConfiguration().PASSWORD_PEPPER;
  return createHmac('sha256', pepper).update(plain).digest('hex');
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(peppered(plain), OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, peppered(plain));
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same CPU as a real verification. Called when the email
 * does not exist so that response time cannot be used to enumerate accounts.
 */
export async function fakeVerifyPassword(): Promise<void> {
  await argon2.hash(peppered('timing-equalisation'), OPTIONS);
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
