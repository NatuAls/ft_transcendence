import type { GlobalRole, OrgRole } from '../generated/prisma/client.ts';
import type { ApiScope } from 'contracts';

/** Who is making the request: a logged-in human, or an API key. */
export interface RequestActor {
  id: string;
  username: string;
  email: string;
  globalRole: GlobalRole;
  /** Present only when the caller authenticated with an API key (public API). */
  apiKeyId?: string;
  scopes?: ApiScope[];
  /** For API keys the organization is fixed by the key itself. */
  organizationId?: string;
}

export interface RequestMembership {
  organizationId: string;
  userId: string;
  role: OrgRole;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  email: string;
  role: GlobalRole;
  jti: string;
  /**
   * Issued-at, stamped by `jsonwebtoken`. Compared against the per-user
   * revocation cutoff in Redis so logout-all, a password change or a reset can
   * invalidate tokens whose `jti` the current request never saw.
   */
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    actor?: RequestActor;
    membership?: RequestMembership;
    requestId?: string;
    startedAt?: number;
    /** Access-token claims of the current session, when one was presented.
     *  `auth.router.ts` needs them to revoke this exact token on logout. */
    accessToken?: AccessTokenPayload;
  }
}

export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  AGENT: 2,
  ORG_ADMIN: 3,
};
