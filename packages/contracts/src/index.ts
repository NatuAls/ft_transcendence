import { z } from 'zod';

const statusRule = z.literal('ok');

export const healthCheckSchema = z.object({
  status: statusRule,
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;
