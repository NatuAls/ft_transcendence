import jwt, { type SignOptions } from 'jsonwebtoken';
import { loadConfiguration } from '../config/env.ts';
import type { AccessTokenPayload } from './types.ts';

/**
 * Thin wrapper around `jsonwebtoken`, standing in for Nest's `JwtService`.
 * Issuer/audience are fixed so a token minted for this API can never be
 * accepted by an unrelated service that happens to share the secret.
 */
const ISSUER = 'helpdesk-lite';
const AUDIENCE = 'helpdesk-web';

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'exp'>,
  expiresIn?: string,
): string {
  const config = loadConfiguration();
  const options: SignOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: (expiresIn ?? config.ACCESS_TOKEN_TTL) as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = loadConfiguration();
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as AccessTokenPayload;
}
