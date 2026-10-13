import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { en } from '../src/core/i18n/locales/en';
import { es } from '../src/core/i18n/locales/es';
import { ca } from '../src/core/i18n/locales/ca';

/**
 * Cada clave de error que la API puede devolver tiene su traducción.
 *
 * La API identifica cada fallo con un `messageKey` —`errors.org.slugTaken`— y
 * las pantallas lo traducen con `t(errorKey(error))`. Si la clave no está en
 * los idiomas de la web, la persona ve la clave tal cual. A 13/10 faltaban 36
 * de las 43 que emite la API, y nadie lo notaba porque las pantallas
 * enseñaban el mensaje en inglés de la API: el día que se tradujeran, saldrían
 * en crudo.
 *
 * Igual que `email-links.test.ts` en la API, esto lee el código de la API y lo
 * cruza: si alguien añade un error nuevo y no lo traduce, el CI lo dice con el
 * nombre de la clave, antes de que llegue a nadie.
 */
// La ruta del disco y no `import.meta.url`: Vite la convierte en su ruta
// virtual `/@fs/…`, que no se puede recorrer con `readdirSync`. Vitest corre
// con el directorio de `apps/web` como actual.
const API_SRC = resolve(process.cwd(), '../api/src');
// Y los contratos compartidos: sus mensajes (`errors.apiKey.scopesRequired`…)
// no los emite la API, pero el navegador valida con el mismo esquema y los
// enseña bajo cada campo.
const CONTRACTS_SRC = resolve(process.cwd(), '../../packages/contracts/src');

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory()) return fuentes(completo);
    return entrada.isFile() && completo.endsWith('.ts') ? [completo] : [];
  });
}

/** Todas las claves `errors.<grupo>.<clave>` que aparecen en el código de la API. */
const clavesDeLaApi = [
  ...new Set(
    [...fuentes(API_SRC), ...fuentes(CONTRACTS_SRC)].flatMap((fichero) =>
      [
        ...readFileSync(fichero, 'utf8').matchAll(
          /errors\.[a-zA-Z]+\.[a-zA-Z]+/g,
        ),
      ].map((coincidencia) => coincidencia[0]),
    ),
  ),
].sort();

/** Las hojas de un objeto de traducciones, como `errors.org.slugTaken`. */
function hojas(objeto: object, prefijo: string[] = []): string[] {
  return Object.entries(objeto).flatMap(([clave, valor]) =>
    typeof valor === 'object' && valor !== null
      ? hojas(valor, [...prefijo, clave])
      : [[...prefijo, clave].join('.')],
  );
}

const idiomas = { en, es, ca } as const;

describe('las claves de error de la API están traducidas', () => {
  it('encuentra las claves, para que la prueba no pase por estar vacía', () => {
    expect(clavesDeLaApi.length).toBeGreaterThan(30);
    expect(clavesDeLaApi).toContain('errors.org.lastAdmin');
  });

  for (const [codigo, traducciones] of Object.entries(idiomas)) {
    it(`todas existen en ${codigo}`, () => {
      const disponibles = new Set(hojas(traducciones));
      const faltan = clavesDeLaApi.filter((clave) => !disponibles.has(clave));
      expect(
        faltan,
        `faltan en ${codigo}.ts — tradúcelas o el usuario las verá en crudo`,
      ).toEqual([]);
    });
  }

  it('una clave que no exista no se enseña en crudo, sino el mensaje genérico', () => {
    const texto = i18next.t('errors.algo.queNoExiste');
    expect(texto).not.toBe('errors.algo.queNoExiste');
    expect(texto).toBe(i18next.t('errors.common.unexpected'));
  });

  it('la red de seguridad no tapa las claves que no son de error', () => {
    // Fuera de `errors.*` se deja ver la clave: en desarrollo es la pista de
    // que falta una traducción de la interfaz.
    expect(i18next.t('organizacion.algoQueNoExiste')).toBe(
      'organizacion.algoQueNoExiste',
    );
  });
});
