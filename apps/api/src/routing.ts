/**
 * The two constants that decide every URL this API answers on.
 *
 * PROBE_PATHS are deliberately outside the versioned prefix: Docker's
 * HEALTHCHECK, and anyone checking whether the API is alive, should never
 * have to know which API version is deployed.
 */
export const GLOBAL_PREFIX = '/api/v1';

export const PROBE_PATHS = ['/api/health', '/api/version'] as const;
