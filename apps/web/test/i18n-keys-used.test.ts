import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../src/core/i18n/locales/en';

/**
 * Cada clave que el código pide existe en los idiomas.
 *
 * `t()` acepta cualquier cadena: una clave mal escrita compila, pasa el lint
 * y sólo se descubre al ver «organization.page.tittle» en pantalla. Las de
 * error las vigila `api-error-keys.test.ts`; esto vigila el resto, leyendo el
 * código del front. Basta con `en`: que `es` y `ca` tengan las mismas lo
 * obliga el tipo `Translation`.
 *
 * Las claves compuestas —`organization.role.${role}`— se comprueban por sus
 * dos extremos: el prefijo tiene que ser un grupo, y lo que va detrás del
 * hueco tiene que existir en alguno de sus miembros. Qué valores toma el hueco
 * no se puede saber leyendo: eso lo cubren los tests que pintan la pantalla.
 */
const SRC = resolve(process.cwd(), 'src');
const NAMESPACES = Object.keys(en).join('|');
// Los nombres de los eventos de tiempo real —`organization.updated`— tienen
// la misma forma que una clave y no lo son.
const NO_SON_CLAVES = new Set(['core/realtime/socket.ts']);

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory())
      return completo.endsWith('locales') ? [] : fuentes(completo);
    return /\.tsx?$/.test(entrada.name) ? [completo] : [];
  });
}

type Arbol = { [clave: string]: string | Arbol };

function nodo(ruta: string): string | Arbol | undefined {
  return ruta
    .split('.')
    .reduce<string | Arbol | undefined>(
      (actual, parte) =>
        typeof actual === 'object' ? actual[parte] : undefined,
      en as unknown as Arbol,
    );
}

/** La clave existe, o existen sus formas de plural (`_one`/`_other`). */
function existe(clave: string): boolean {
  if (typeof nodo(clave) === 'string') return true;
  return (
    typeof nodo(`${clave}_one`) === 'string' &&
    typeof nodo(`${clave}_other`) === 'string'
  );
}

/** El código sin comentarios: en ellos se nombran claves sin usarlas. */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const codigo = fuentes(SRC)
  .map((fichero) => ({
    fichero: fichero.slice(SRC.length + 1),
    texto: sinComentarios(readFileSync(fichero, 'utf8')),
  }))
  .filter(({ fichero }) => !NO_SON_CLAVES.has(fichero));

describe('claves de traducción usadas en el código', () => {
  it('cada clave literal existe', () => {
    const literal = new RegExp(
      `['"\`]((?:${NAMESPACES})\\.[\\w.]+)['"\`]`,
      'g',
    );
    const faltan: string[] = [];
    let vistas = 0;
    for (const { fichero, texto } of codigo)
      for (const [, clave] of texto.matchAll(literal)) {
        vistas += 1;
        if (!existe(clave!)) faltan.push(`${fichero}: ${clave}`);
      }
    expect(vistas).toBeGreaterThan(300);
    expect(faltan).toEqual([]);
  });

  it('cada clave compuesta encaja con lo que hay', () => {
    const compuesta = new RegExp(
      `\`((?:${NAMESPACES})\\.[\\w.]*?)\\$\\{[^}]+\\}([\\w.]*)\``,
      'g',
    );
    const faltan: string[] = [];
    for (const { fichero, texto } of codigo)
      for (const [, prefijo, resto] of texto.matchAll(compuesta)) {
        const grupo = nodo(prefijo!.replace(/\.$/, ''));
        if (typeof grupo !== 'object') {
          faltan.push(`${fichero}: ${prefijo}… no es un grupo`);
          continue;
        }
        if (!resto) continue;
        const encaja = Object.keys(grupo).some((miembro) =>
          resto.startsWith('.')
            ? existe(`${prefijo}${miembro}${resto}`)
            : miembro.endsWith(resto),
        );
        if (!encaja) faltan.push(`${fichero}: ${prefijo}\${…}${resto}`);
      }
    expect(faltan).toEqual([]);
  });
});
