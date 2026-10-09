/**
 * De dónde sale el origen de los enlaces que viajan por correo.
 *
 * `email-links.test.ts` ya vigila la RUTA del enlace. Esto vigila el HOST, que
 * es el otro modo de que el enlace no lleve a ninguna parte, y es el que falló
 * en desarrollo: el navegador está en el 5173 y Vite reenvía `/api` al 5000 con
 * `changeOrigin`, así que la API veía `Host: localhost:5000` y escribía
 *
 *     https://127.0.0.1:5000/#register?email=…
 *
 * el puerto de la API, por https, sin nada que lo sirva. Quien recibía la
 * invitación a una organización no podía crear su cuenta, el rol reservado se
 * quedaba esperando para siempre y parecía que el usuario añadido se perdía.
 *
 * La configuración se parsea una vez por proceso, así que cada caso corre en el
 * suyo, igual que en `docs-access.test.ts`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Valores de usar y tirar: sólo tienen que dejar que la configuración parsee.
const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/d?schema=public',
  JWT_ACCESS_SECRET: 'test_access_secret_not_a_real_secret_0123456789',
  JWT_REFRESH_SECRET: 'test_refresh_secret_not_a_real_secret_0123456789',
  PASSWORD_PEPPER: 'test_pepper_not_a_real_secret_0123456789',
  CORS_ORIGINS: 'http://localhost:5173',
  LOG_LEVEL: 'error',
};

const MODULE = fileURLToPath(
  new URL('../../src/common/utils/http.ts', import.meta.url),
);

/** El origen que sale de unas cabeceras y un entorno, en su propio proceso. */
function originWith(
  headers: Record<string, string>,
  env: Record<string, string | undefined> = {},
): string {
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { originOf } from ${JSON.stringify(MODULE)};
       const req = { headers: ${JSON.stringify(headers)} };
       console.log('ORIGIN=' + originOf(req));`,
    ],
    { env: { ...BASE_ENV, ...env }, encoding: 'utf8' },
  );
  const line = output.split('\n').find((row) => row.startsWith('ORIGIN='));
  assert.ok(line, `no salió ningún origen:\n${output}`);
  return line.slice('ORIGIN='.length);
}

const ENV_MODULE = fileURLToPath(
  new URL('../../src/config/env.ts', import.meta.url),
);

/** Parsea la configuración en su propio proceso; lanza si el entorno no vale. */
function configurationWith(env: Record<string, string | undefined>): void {
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { loadConfiguration } from ${JSON.stringify(ENV_MODULE)};
       loadConfiguration();`,
    ],
    { env: { ...BASE_ENV, ...env }, encoding: 'utf8', stdio: 'pipe' },
  );
}

/**
 * Nadie vuelve a deducir el origen por su cuenta.
 *
 * Esta parte existe porque la anterior no bastó. Al añadir APP_PUBLIC_ORIGIN
 * se arregló `originOf`, pero había TRES copias de la misma lógica de
 * cabeceras repartidas por la API, y una de ellas —`contextOf` en
 * `auth.router.ts`— es justo la que construye los enlaces de verificar la
 * cuenta y de recuperar la contraseña. Quedó atrás, así que esos dos correos
 * siguieron naciendo contra el puerto de la API hasta el 08/10, con la prueba
 * de arriba en verde.
 *
 * Probar la función no prueba que sus llamadores la usen. Esto sí.
 */
describe('la lógica del origen vive en un solo sitio', () => {
  const API_SRC = new URL('../../src', import.meta.url).pathname;
  const PERMITIDO = 'common/utils/http.ts';

  /** Todos los `.ts` del árbol de la API. */
  function fuentes(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
      const completo = join(dir, entrada.name);
      if (entrada.isDirectory()) return fuentes(completo);
      return entrada.isFile() && completo.endsWith('.ts') ? [completo] : [];
    });
  }

  const culpables = fuentes(API_SRC).filter((fichero) => {
    if (fichero.endsWith(PERMITIDO)) return false;
    return readFileSync(fichero, 'utf8').includes('x-forwarded-proto');
  });

  it('sólo http.ts lee las cabeceras reenviadas', () => {
    assert.deepEqual(
      culpables.map((fichero) => fichero.slice(API_SRC.length + 1)),
      [],
      'estos ficheros se construyen el origen por su cuenta y se quedarán ' +
        'atrás en el próximo cambio: usa originOf(req)',
    );
  });

  it('y alguien la usa, para que la prueba no pase por estar vacía', () => {
    const usuarios = fuentes(API_SRC).filter((fichero) =>
      readFileSync(fichero, 'utf8').includes('originOf(req)'),
    );
    assert.ok(
      usuarios.length >= 2,
      `sólo ${usuarios.length} fichero(s) usan originOf(req)`,
    );
  });
});

describe('el origen de los enlaces de los correos', () => {
  it('detrás del proxy lo deduce de las cabeceras reenviadas', () => {
    assert.equal(
      originWith({
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'helpdesklite.me',
        host: 'helpdesk-api-prod:5000',
      }),
      'https://helpdesklite.me',
    );
  });

  it('APP_PUBLIC_ORIGIN manda sobre lo que digan las cabeceras', () => {
    // Las cabeceras de desarrollo: Vite reescribió el host al de la API.
    assert.equal(
      originWith(
        { host: 'localhost:5000' },
        { APP_PUBLIC_ORIGIN: 'http://localhost:5173' },
      ),
      'http://localhost:5173',
    );
  });

  it('nunca escribe el enlace contra el puerto de la API en desarrollo', () => {
    const origin = originWith(
      { host: '127.0.0.1:5000' },
      { APP_PUBLIC_ORIGIN: 'http://localhost:5173' },
    );
    assert.ok(
      !origin.includes(':5000'),
      `el enlace apuntaría a la API: ${origin}`,
    );
  });

  it('no deja una barra de más, que doblaría la del fragmento', () => {
    assert.equal(
      originWith(
        { host: 'localhost:5000' },
        { APP_PUBLIC_ORIGIN: 'https://helpdesklite.me/' },
      ),
      'https://helpdesklite.me',
    );
  });

  it('vacío es como no definirla: vuelve a las cabeceras', () => {
    assert.equal(
      originWith(
        { 'x-forwarded-proto': 'https', host: 'helpdesklite.me' },
        { APP_PUBLIC_ORIGIN: '' },
      ),
      'https://helpdesklite.me',
    );
  });

  it('el arranque rechaza un origen mal escrito, en vez de escribir enlaces rotos', () => {
    // `localhost:5173` ES una URL válida para el parser (esquema `localhost:`,
    // camino `5173`), así que una comprobación de «es una URL» la dejaba pasar
    // y los enlaces seguían sin llevar a ninguna parte. Quien lo rechaza es el
    // esquema del arranque, no el ayudante, que ya no depende de él.
    assert.throws(
      () => configurationWith({ APP_PUBLIC_ORIGIN: 'localhost:5173' }),
      /APP_PUBLIC_ORIGIN/,
    );
    assert.throws(
      () => configurationWith({ APP_PUBLIC_ORIGIN: 'no es una url' }),
      /APP_PUBLIC_ORIGIN/,
    );
    // Y acepta los dos esquemas que sí se sirven.
    configurationWith({ APP_PUBLIC_ORIGIN: 'http://localhost:5173' });
    configurationWith({ APP_PUBLIC_ORIGIN: 'https://helpdesklite.me' });
  });
});
