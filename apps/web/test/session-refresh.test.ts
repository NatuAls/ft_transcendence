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

  // El síntoma del 15/10: con la API parada no se rechaza el `fetch`. Contesta
  // lo que tiene delante —Vite en desarrollo con un 500, nginx en producción con
  // un 502/503/504— y eso se tomaba por «no hay sesión»: quien recargaba durante
  // un reinicio de la API acababa en el inicio de sesión con la sesión viva.
  it.each([500, 502, 503, 504])(
    'si contesta el proxy porque la API está parada (%i), tampoco es un null',
    async (status) => {
      document.cookie = 'hd_session=1; path=/';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status })),
      );
      const { refreshSession, SessionUnreachable } = await cargar();
      await expect(refreshSession()).rejects.toBeInstanceOf(SessionUnreachable);
    },
  );

  it('ni el limitador (429): la sesión sigue ahí, sólo hay que esperar', async () => {
    document.cookie = 'hd_session=1; path=/';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 })),
    );
    const { refreshSession, SessionUnreachable } = await cargar();
    await expect(refreshSession()).rejects.toBeInstanceOf(SessionUnreachable);
  });

  it('un 403 sí es la API diciendo que no hay sesión que renovar', async () => {
    document.cookie = 'hd_session=1; path=/';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    );
    const { refreshSession } = await cargar();
    await expect(refreshSession()).resolves.toBeNull();
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

/**
 * Dos pestañas no renuevan a la vez.
 *
 * Cada renovación gasta la cookie y deja otra; si dos pestañas mandaban la
 * misma, la API tomaba la segunda por un token robado y cerraba la sesión en
 * todas. Las pestañas se turnan con Web Locks: aquí, cada «pestaña» es un
 * módulo cargado por separado (su propio estado en memoria) que comparte el
 * cerrojo, como comparten el navegador.
 */
describe('renovar la sesión con varias pestañas abiertas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    Reflect.deleteProperty(navigator, 'locks');
    document.cookie = 'hd_session=; max-age=0; path=/';
  });

  /** Un LockManager mínimo: una cola por nombre, como el del navegador. */
  function cerrojos() {
    let cola: Promise<unknown> = Promise.resolve();
    const request = vi.fn(
      (_nombre: string, trabajo: () => Promise<unknown>) => {
        const turno = cola.then(trabajo);
        cola = turno.catch(() => undefined);
        return turno;
      },
    );
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });
    return request;
  }

  async function pestana() {
    vi.resetModules();
    return import('../src/api/auth');
  }

  it('la segunda espera a que la primera termine, y las dos salen con sesión', async () => {
    document.cookie = 'hd_session=1; path=/';
    const request = cerrojos();
    let enVuelo = 0;
    let maximo = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        enVuelo += 1;
        maximo = Math.max(maximo, enVuelo);
        await new Promise((listo) => setTimeout(listo, 10));
        enVuelo -= 1;
        return new Response(
          JSON.stringify({ accessToken: 'renovado', user: {} }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }),
    );
    const primera = await pestana();
    const segunda = await pestana();
    const [a, b] = await Promise.all([
      primera.refreshSession(),
      segunda.refreshSession(),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(maximo).toBe(1);
    expect(a?.accessToken).toBe('renovado');
    expect(b?.accessToken).toBe('renovado');
  });
});
