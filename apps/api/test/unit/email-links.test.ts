import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Los enlaces que la API mete en los correos TIENEN que apuntar a una ruta que
 * el front conozca.
 *
 * Este guardia existe porque el mismo defecto apareció tres veces:
 *
 *   · `/verify-email?token=…`  — nadie podía confirmar su dirección, así que
 *     ningún rol reservado para un correo llegaba nunca a su cuenta.
 *   · `/app/settings/privacy/confirm?type=…` — ni exportación ni borrado de
 *     datos se podían confirmar.
 *   · `/reset-password?token=…` — la recuperación de contraseña no se podía
 *     completar.
 *
 * Los tres se veían igual: Nginx servía `index.html`, el router de fragmento
 * veía el fragmento vacío, y la persona acababa en la pantalla de inicio con
 * el testigo perdido. Ninguna prueba lo cazaba porque el correo se enviaba sin
 * error y el endpoint respondía 200.
 *
 * La comprobación es deliberadamente tonta y por eso aguanta: lee el código
 * que construye los enlaces y la tabla de rutas del front, y los cruza.
 */

const API_SRC = new URL('../../src', import.meta.url).pathname;
const WEB_ROUTES = new URL('../../../web/src/app/routes.ts', import.meta.url)
  .pathname;

/** Todos los `.ts` de un árbol. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

/** Las rutas que declara el router del front (`const routes = new Set([...])`). */
function webRoutes(): Set<string> {
  const text = readFileSync(WEB_ROUTES, 'utf8');
  const block = /const routes = new Set<AppRoute>\(\[([\s\S]*?)\]\)/.exec(text);
  assert.ok(block, 'no encuentro la tabla de rutas del front');
  return new Set(
    [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]!),
  );
}

interface Link {
  file: string;
  line: number;
  raw: string;
}

/** Cada plantilla `${…origin}/…` que aparece en el código de la API. */
function links(): Link[] {
  const found: Link[] = [];
  for (const file of sources(API_SRC)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, index) => {
        for (const match of text.matchAll(/\$\{(?:ctx\.)?origin\}([^`]*)/g)) {
          found.push({
            file: file.slice(API_SRC.length + 1),
            line: index + 1,
            raw: match[1]!,
          });
        }
      });
  }
  return found;
}

describe('los enlaces de los correos apuntan a rutas que existen', () => {
  it('encuentra los enlaces, para que la prueba no pase por estar vacía', () => {
    assert.ok(
      links().length >= 5,
      `esperaba varios enlaces y he encontrado ${links().length}`,
    );
  });

  it('todos van al fragmento, que es lo que lee el router del front', () => {
    for (const link of links()) {
      assert.ok(
        link.raw.startsWith('/#'),
        `${link.file}:${link.line} construye "${link.raw}" sin "#": el router ` +
          'del front no lo verá y el testigo se perderá',
      );
    }
  });

  it('cada ruta del enlace está en la tabla de rutas del front', () => {
    const rutas = webRoutes();
    for (const link of links()) {
      // `/#ruta?query` o `/#ruta`; se ignoran las plantillas que eligen la
      // ruta en tiempo de ejecución (`/#${view}`), que se comprueban aparte.
      const route = /^\/#([a-z0-9/-]+)/.exec(link.raw)?.[1];
      if (!route) continue;
      assert.ok(
        rutas.has(route),
        `${link.file}:${link.line} enlaza a "#${route}", que no existe en ` +
          'apps/web/src/app/routes.ts',
      );
    }
  });

  it('las rutas que el RGPD elige en tiempo de ejecución también existen', () => {
    const rutas = webRoutes();
    for (const route of [
      'account/export-requested',
      'account/delete',
      'account/export-ready',
    ]) {
      assert.ok(rutas.has(route), `#${route} no existe en el router del front`);
    }
  });
});
