/**
 * Small vocabulary shared by the eleven path files, so an operation reads like
 * what it is - tag, summary, who may call it, what it takes and what it answers -
 * instead of fifty lines of nested OpenAPI boilerplate.
 */
import { ref, type JsonSchema } from '../schemas.ts';

export type Operation = Record<string, unknown>;
export type Paths = Record<string, Record<string, unknown>>;

/** Security requirements. An empty array on the operation means "no auth". */
export const session = [{ bearerAuth: [] as string[] }];
export const cookie = [{ cookieAuth: [] as string[] }];
export const key = (...scopes: string[]) => [{ apiKeyAuth: scopes }];
export const open: Array<Record<string, string[]>> = [];

const ERRORS: Record<string, string> = {
  '400': 'BadRequest',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'NotFound',
  '409': 'Conflict',
  '413': 'PayloadTooLarge',
  '415': 'UnsupportedMediaType',
  '422': 'UnprocessableEntity',
  '429': 'TooManyRequests',
};

/** `errs('400','401')` → the shared error responses, by reference. */
export function errs(...codes: Array<keyof typeof ERRORS>): JsonSchema {
  return Object.fromEntries(
    codes.map((code) => [
      code,
      { $ref: `#/components/responses/${ERRORS[code]}` },
    ]),
  );
}

/** A 200 with a JSON body. */
export function ok(
  description: string,
  schema: JsonSchema,
  example?: unknown,
): JsonSchema {
  return {
    description,
    content: {
      'application/json': {
        schema,
        ...(example === undefined ? {} : { example }),
      },
    },
    headers: {
      'X-Request-Id': { $ref: '#/components/headers/RequestId' },
      'RateLimit-Limit': { $ref: '#/components/headers/RateLimitLimit' },
      'RateLimit-Remaining': {
        $ref: '#/components/headers/RateLimitRemaining',
      },
      'RateLimit-Reset': { $ref: '#/components/headers/RateLimitReset' },
    },
  };
}

/** A 201 with the created resource. */
export function created(
  description: string,
  schema: JsonSchema,
  example?: unknown,
): JsonSchema {
  return {
    description,
    content: {
      'application/json': {
        schema,
        ...(example === undefined ? {} : { example }),
      },
    },
  };
}

/** A 204: the API answers these with an empty body, never with `{}`. */
export function noContent(description: string): JsonSchema {
  return { description };
}

/** The paginated envelope every list endpoint returns. */
export function listOf(componentName: string, description: string): JsonSchema {
  return ok(description, {
    type: 'object',
    properties: {
      data: { type: 'array', items: ref(componentName) },
      meta: ref('PaginationMeta'),
    },
    required: ['data', 'meta'],
  });
}

/** A request body built from a component (which in turn comes from a contract). */
export function body(componentName: string, description?: string): JsonSchema {
  return {
    required: true,
    ...(description ? { description } : {}),
    content: { 'application/json': { schema: ref(componentName) } },
  };
}

export interface OperationInput {
  tag: string;
  summary: string;
  description: string;
  security: Array<Record<string, string[]>>;
  operationId: string;
  parameters?: JsonSchema[];
  requestBody?: JsonSchema;
  responses: JsonSchema;
  deprecated?: boolean;
}

export function op(input: OperationInput): Operation {
  const { tag, security, parameters, requestBody, responses, ...rest } = input;
  return {
    tags: [tag],
    ...rest,
    security,
    ...(parameters?.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
}

/** Query parameter shorthand. */
export function query(
  name: string,
  description: string,
  schema: JsonSchema = { type: 'string' },
  extra: JsonSchema = {},
): JsonSchema {
  return { name, in: 'query', description, schema, ...extra };
}

/** Path parameter shorthand. */
export function pathParam(
  name: string,
  description: string,
  schema: JsonSchema = { type: 'string', format: 'uuid' },
): JsonSchema {
  return { name, in: 'path', required: true, description, schema };
}
