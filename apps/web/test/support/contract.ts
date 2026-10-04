/**
 * The API's own OpenAPI document and the strict validator its tests use.
 *
 * Every answer the web tests feed to a screen goes through `conforming()`
 * first, so a fixture cannot invent a shape the API does not return. The API
 * side (`apps/api/test/integration/openapi-contract.test.ts`) checks that the
 * real answers match the same document: between the two, the web client is
 * tested against what the server actually sends.
 */
import { buildDocument } from '../../../api/src/modules/openapi/document.ts';
import {
  validate,
  type Schema,
} from '../../../api/test/support/openapi-schema.ts';

type Loose = Record<string, unknown>;

const document = buildDocument({ version: 'web-tests' }) as Loose;

/** The documented schema of `METHOD /template` for that status. */
function schemaOf(operation: string, status: number): Schema | undefined {
  const [method, template] = operation.split(' ') as [string, string];
  const paths = document['paths'] as Record<string, Record<string, Loose>>;
  const found = paths[template]?.[method.toLowerCase()];
  if (!found) throw new Error(`${operation} is not in the API document`);
  let response = (found['responses'] as Record<string, Loose>)[String(status)];
  if (!response)
    throw new Error(`${operation} does not document a ${status} answer`);
  const reference = response['$ref'];
  if (typeof reference === 'string')
    response = ((
      document['components'] as Record<string, Record<string, Loose>>
    )['responses'] ?? {})[reference.split('/').pop()!]!;
  return (response['content'] as Record<string, Loose> | undefined)?.[
    'application/json'
  ]?.['schema'] as Schema | undefined;
}

/** Returns `body` unchanged, or throws if the API document disagrees. */
export function conforming<T>(operation: string, status: number, body: T): T {
  const schema = schemaOf(operation, status);
  if (!schema) {
    if (body !== undefined)
      throw new Error(`${operation} ${status} is documented without a body`);
    return body;
  }
  const problems = validate(document, schema, body);
  if (problems.length)
    throw new Error(
      `fixture for ${operation} ${status} does not match the API document:\n` +
        problems.join('\n'),
    );
  return body;
}
