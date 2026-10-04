/**
 * ============================================================================
 *  A strict validator for the OpenAPI 3.0 schemas of our own document.
 *
 *  Shared by `test/unit/openapi.test.ts` (every example against its schema)
 *  and `test/integration/openapi-contract.test.ts` (real answers of the API
 *  against the documented ones). It is deliberately small and STRICT:
 *
 *    · an object that lists its `properties` accepts no other key, unless the
 *      schema says `additionalProperties`. A field the API returns and the
 *      document does not mention is drift, and drift is what we hunt;
 *    · `nullable` has to be declared for a null to pass;
 *    · `required` keys must be there.
 *
 *  It covers the keywords the document actually uses - $ref, type, nullable,
 *  enum, properties, required, additionalProperties, items, allOf, anyOf,
 *  oneOf and the formats uuid, date-time, date and email - and throws on any
 *  other keyword it meets in a response schema, so a new construct cannot
 *  pass unchecked.
 * ============================================================================
 */
export type Schema = Record<string, unknown>;

const HANDLED = new Set([
  '$ref',
  'type',
  'nullable',
  'enum',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'allOf',
  'anyOf',
  'oneOf',
  'format',
  // Annotations: they describe, they do not constrain a response.
  'description',
  'example',
  'default',
  'title',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
]);

const FORMATS: Record<string, RegExp> = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'date-time':
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
};

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

/** Follows `#/components/...` references inside the document. */
function resolve(document: Schema, schema: Schema): Schema {
  let current = schema;
  const seen = new Set<string>();
  while (typeof current['$ref'] === 'string') {
    const pointer = current['$ref'];
    if (seen.has(pointer)) throw new Error(`circular $ref ${pointer}`);
    seen.add(pointer);
    let target: unknown = document;
    for (const part of pointer.replace(/^#\//, '').split('/'))
      target = (target as Schema | undefined)?.[part];
    if (!target || typeof target !== 'object')
      throw new Error(`unresolved $ref ${pointer}`);
    current = target as Schema;
  }
  return current;
}

/**
 * Every problem of `value` against `schema`, as `path: message` strings.
 * An empty array means it conforms.
 */
export function validate(
  document: Schema,
  schema: Schema,
  value: unknown,
  path = '$',
): string[] {
  const node = resolve(document, schema);
  for (const keyword of Object.keys(node))
    if (!HANDLED.has(keyword))
      throw new Error(
        `${path}: the validator does not know the keyword "${keyword}"`,
      );

  if (value === null) {
    if (node['nullable'] === true) return [];
    // `nullableRef` puts `nullable` on the wrapper; a bare `allOf` member
    // must still accept the null its wrapper allowed, so it is checked there.
    if (node['type'] === undefined && !node['allOf'] && !node['anyOf'])
      return [];
    if (node['anyOf'] || node['oneOf']) {
      const options = (node['anyOf'] ?? node['oneOf']) as Schema[];
      return options.some(
        (o) => validate(document, o, value, path).length === 0,
      )
        ? []
        : [`${path}: null is not allowed here`];
    }
    return [`${path}: null is not allowed (declare nullable)`];
  }

  const errors: string[] = [];

  if (node['allOf'])
    for (const part of node['allOf'] as Schema[])
      errors.push(...validate(document, part, value, path));

  for (const key of ['anyOf', 'oneOf'] as const) {
    if (!node[key]) continue;
    const matches = (node[key] as Schema[]).filter(
      (option) => validate(document, option, value, path).length === 0,
    ).length;
    if (key === 'anyOf' ? matches === 0 : matches !== 1)
      errors.push(`${path}: matches ${matches} of the ${key} options`);
  }

  const type = node['type'] as string | undefined;
  if (type) {
    const actual = typeOf(value);
    const ok = actual === type || (type === 'number' && actual === 'integer');
    if (!ok) return [...errors, `${path}: expected ${type}, got ${actual}`];
  }

  if (node['enum'] && !(node['enum'] as unknown[]).includes(value))
    errors.push(
      `${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(node['enum'])}`,
    );

  if (typeof value === 'string' && typeof node['format'] === 'string') {
    const pattern = FORMATS[node['format']];
    if (pattern && !pattern.test(value))
      errors.push(`${path}: "${value}" is not a valid ${node['format']}`);
  }

  if (typeOf(value) === 'array' && node['items'])
    (value as unknown[]).forEach((item, index) =>
      errors.push(
        ...validate(
          document,
          node['items'] as Schema,
          item,
          `${path}[${index}]`,
        ),
      ),
    );

  if (typeOf(value) === 'object') {
    const object = value as Record<string, unknown>;
    const properties = (node['properties'] ?? {}) as Record<string, Schema>;
    for (const key of (node['required'] ?? []) as string[])
      if (!(key in object)) errors.push(`${path}.${key}: required`);
    for (const [key, child] of Object.entries(object)) {
      if (properties[key]) {
        errors.push(
          ...validate(document, properties[key], child, `${path}.${key}`),
        );
        continue;
      }
      const extra = node['additionalProperties'];
      if (extra && typeof extra === 'object')
        errors.push(
          ...validate(document, extra as Schema, child, `${path}.${key}`),
        );
      else if (extra === false || (extra === undefined && node['properties']))
        errors.push(`${path}.${key}: not in the documented schema`);
    }
  }

  return errors;
}
