import { afterEach, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { createApiKeySchema, uuidSchema } from 'contracts';
import { fieldErrorsFromIssues } from '../src/core/api/errors';

/**
 * Errores de campo de los esquemas compartidos, cuando el esquema no trae una
 * clave propia.
 *
 * `createApiKeySchema` pide `name: min(3)` a secas: Zod pone entonces su frase
 * técnica en inglés —«Too small: expected string to have >=3 characters»— y
 * el código real (`too_small`) aparte. La pantalla enseñaba la frase. Ahora se
 * traduce por el código, y un código sin frase propia da la genérica, nunca
 * el código ni el inglés de Zod.
 */
const issues = (
  schema: { safeParse: (v: unknown) => unknown },
  value: unknown,
) =>
  (
    schema.safeParse(value) as {
      error: { issues: Parameters<typeof fieldErrorsFromIssues>[0] };
    }
  ).error.issues;

afterEach(async () => {
  await i18next.changeLanguage('en');
});

describe('errores de campo sin clave propia', () => {
  it('se traducen por su código, y la clave propia sigue mandando', () => {
    const errores = fieldErrorsFromIssues(
      issues(createApiKeySchema, { name: 'ab', scopes: [] }),
    );
    expect(errores).toEqual({
      name: 'This value is too short.',
      scopes: 'Choose at least one permission.',
    });
  });

  it('un código sin frase propia da la genérica, no el código ni el inglés de Zod', () => {
    const errores = fieldErrorsFromIssues([
      ...issues(uuidSchema, 'no-es-un-id').map((issue) => ({
        ...issue,
        path: ['id'],
      })),
    ]);
    expect(errores).toEqual({ id: 'Check this field.' });
  });

  it('en castellano, igual', async () => {
    await i18next.changeLanguage('es');
    const errores = fieldErrorsFromIssues(
      issues(createApiKeySchema, { name: 'ab', scopes: [] }),
    );
    expect(errores.name).toBe('Este valor es demasiado corto.');
    expect(Object.values(errores).join(' ')).not.toMatch(/Too small|Invalid/);
  });
});
