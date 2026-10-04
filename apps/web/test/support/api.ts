import { vi } from 'vitest';
import { conforming } from './contract';

/**
 * A fake API behind `fetch`. Each route is `"METHOD /path"` (the path after
 * `/api/v1`, without the query string) and answers a status and a body that
 * is checked against the API document for the operation it names.
 */
export interface Call {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  path: string;
  query: URLSearchParams;
}

export interface Reply {
  body?: unknown;
  status: number;
}

type Handler = (call: Call) => Reply | Promise<Reply>;

/** A documented answer: `reply('GET /users', 200, page)`. */
export function reply(
  operation: string,
  status: number,
  body?: unknown,
): Reply {
  return { status, body: conforming(operation, status, body) };
}

/** The ApiError envelope, as the API sends it. */
export function apiError(
  operation: string,
  status: number,
  code: string,
  message: string,
): Reply {
  return reply(operation, status, {
    statusCode: status,
    code,
    messageKey: `errors.test.${code}`,
    message,
    requestId: '01a10712-4c1e-7b3d-a0f2-9be1d07c5a11',
    timestamp: '2026-10-04T10:00:00.000Z',
    path: '/api/v1/test',
  });
}

export function mockApi(routes: Record<string, Handler | Reply>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const headers = Object.fromEntries(
        new Headers(init?.headers as HeadersInit | undefined).entries(),
      );
      const body =
        typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      const call: Call = {
        body,
        headers,
        method,
        path,
        query: url.searchParams,
      };
      calls.push(call);
      const route = routes[`${method} ${path}`];
      if (!route)
        return new Response(
          JSON.stringify({ message: `unexpected ${method} ${path}` }),
          { status: 599 },
        );
      const answer = typeof route === 'function' ? await route(call) : route;
      return new Response(
        answer.body === undefined ? null : JSON.stringify(answer.body),
        {
          status: answer.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
