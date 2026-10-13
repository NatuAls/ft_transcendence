import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Un servidor que no contesta no es una sesión cerrada.
 *
 * El síntoma del 08/10: al parar y volver a arrancar el contenedor de la API,
 * la aplicación saltaba a la pantalla de inicio de sesión y se quedaba ahí,
 * aunque la cookie de sesión seguía viva; sólo F5 la recuperaba. La causa era
 * que `refreshSession()` no distinguía «el servidor dice que no hay sesión»
 * (su `fetch` responde) de «no he podido hablar con el servidor» (su `fetch`
 * se rechaza), y el rechazo se perdía.
 */
describe('renovar la sesión cuando el servidor no está', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.cookie = 'hd_session=; max-age=0; path=/';
  });

  async function cargar() {
    // Cada caso con su módulo: `refreshPromise` es estado del módulo.
    vi.resetModules();
    return import('../src/api/auth');
  }

  it('sin cookie de sesión no se molesta en preguntar', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { refreshSession } = await cargar();
    await expect(refreshSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si el servidor contesta que no hay sesión, devuelve null', async () => {
    document.cookie = 'hd_session=1; path=/';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    );
    const { refreshSession } = await cargar();
    await expect(refreshSession()).resolves.toBeNull();
  });

  it('si el servidor no contesta, avisa de que no se pudo: no es un null', async () => {
    document.cookie = 'hd_session=1; path=/';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const { refreshSession, SessionUnreachable } = await cargar();
    await expect(refreshSession()).rejects.toBeInstanceOf(SessionUnreachable);
  });

  it('y se puede volver a intentar: el corte no deja la promesa atascada', async () => {
    document.cookie = 'hd_session=1; path=/';
    let caido = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (caido) throw new TypeError('Failed to fetch');
        return new Response(
          JSON.stringify({ accessToken: 'nuevo', user: {} }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }),
    );
    const { refreshSession, getAccessToken } = await cargar();
    await expect(refreshSession()).rejects.toBeTruthy();
    // La API vuelve: el segundo intento tiene que funcionar sin recargar.
    caido = false;
    const sesion = await refreshSession();
    expect(sesion).toBeTruthy();
    expect(getAccessToken()).toBe('nuevo');
  });
});
