import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lo que Chrome anotaba en cada carga sin que nada fallara.
 *
 * Ninguno rompía una pantalla, pero llenaban la consola y el panel Issues
 * y escondían los avisos que sí importan:
 *
 *   · zod 4 prueba `new Function('')` al crear sus esquemas, para compilar
 *     validadores más rápidos. La CSP (`script-src 'self'`) lo bloquea y
 *     Chrome lo anota como «blocks the use of `eval`». `src/core/zod.ts` lo
 *     apaga con `jitless`, y sólo sirve si se carga antes que `contracts`.
 *   · Un campo de formulario sin `id` ni `name`: Chrome avisa de que el
 *     autocompletado no puede reconocerlo. Se habían juntado quince.
 *
 * Los avisos «report-only» que sólo salen en algunas cargas no son de este
 * código: los añade Cloudflare a una muestra de las respuestas para hacer
 * inventario de scripts y conexiones, y no bloquean nada.
 */
const SRC = resolve(process.cwd(), 'src');
const UI = resolve(process.cwd(), '../../packages/ui/src');

/**
 * Cuántas veces se usa el constructor `Function` al crear y usar un esquema
 * de objeto, en un Node recién arrancado: zod guarda en caché el resultado de
 * su prueba, así que en el proceso de los tests ya no se vería.
 */
function usosDeFunction(antes: string): number {
  const programa = `
    let usos = 0;
    globalThis.Function = new Proxy(Function, {
      construct(objetivo, args) {
        usos++;
        return Reflect.construct(objetivo, args);
      },
    });
    ${antes}
    const { z } = await import('zod');
    z.object({ titulo: z.string() }).parse({ titulo: 'Impresora' });
    process.stdout.write(String(usos));
  `;
  return Number(
    execFileSync(process.execPath, ['--input-type=module', '-e', programa], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory()) return fuentes(completo);
    return /\.tsx$/.test(entrada.name) ? [completo] : [];
  });
}

/** Los comentarios, en blanco pero sin mover las líneas (las URL se quedan). */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, (comentario) =>
    comentario.replace(/[^\n]/g, ' '),
  );

/** La etiqueta de apertura que empieza en `inicio`, hasta su `>`. */
function etiqueta(texto: string, inicio: number): string {
  let llaves = 0;
  for (let i = inicio + 1; i < texto.length; i++) {
    const c = texto[i];
    if (c === '{') llaves++;
    else if (c === '}') llaves--;
    else if (c === '"' && llaves === 0) {
      const cierre = texto.indexOf('"', i + 1);
      if (cierre < 0) break;
      i = cierre;
    } else if (c === '>' && llaves === 0) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

describe('avisos de Chrome al cargar', () => {
  it('zod no intenta compilar con new Function', () => {
    // Sin la configuración lo intenta: si no, la segunda no probaría nada.
    expect(usosDeFunction('')).toBeGreaterThan(0);
    const zod = JSON.stringify(join(SRC, 'core/zod.ts'));
    expect(usosDeFunction(`await import(${zod});`)).toBe(0);
  });

  it('y la configuración se carga antes que cualquier esquema', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const [primero] = main.match(/^import\s.*$/m) ?? [];
    expect(primero).toBe("import './core/zod';");
  });

  it('cada campo de formulario tiene id o name', () => {
    const sinNombre: string[] = [];
    let vistos = 0;
    for (const fichero of [...fuentes(SRC), ...fuentes(UI)]) {
      const texto = sinComentarios(readFileSync(fichero, 'utf8'));
      for (const campo of texto.matchAll(/<(input|select|textarea)\b/g)) {
        vistos++;
        if (/\s(id|name)=/.test(etiqueta(texto, campo.index))) continue;
        const linea = texto.slice(0, campo.index).split('\n').length;
        sinNombre.push(`${relative(process.cwd(), fichero)}:${linea}`);
      }
    }
    expect(vistos).toBeGreaterThan(20);
    expect(sinNombre).toEqual([]);
  });
});
