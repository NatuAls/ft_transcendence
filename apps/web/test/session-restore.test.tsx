import { describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { getAccessToken, type AuthResponse } from '../src/api/auth';
import { mockApi, type Call } from './support/api';
import { ids } from './support/fixtures';

/**
 * La sesión se restaura al abrir la aplicación, no en cada navegación.
 *
 * El efecto que la restaura vuelve a correr en cada cambio de ruta, porque es
 * el que manda al inicio de sesión a quien entra sin sesión en una ruta
 * privada, y renovaba la sesión cada vez: una rotación de la cookie por
 * pantalla. Una renovación cortada a medias por una recarga dejaba al
 * navegador con la cookie ya gastada, y la API, al verla volver, cerraba la
 * sesión (lo vio Felipe el 15/10, con dos 401 en la consola al recargar).
 */
vi.mock('../src/core/realtime/socket', async () => {
  const real = await vi.importActual<
    typeof import('../src/core/realtime/socket')
  >('../src/core/realtime/socket');
  return { ...real, connectRealtime: vi.fn(), disconnectRealtime: vi.fn() };
});

const { default: App } = await import('../src/App');

// jsdom no implementa el desplazamiento de la ventana al cambiar de pantalla.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

const user: AuthResponse['user'] = {
  id: ids.admin,
  username: 'ana',
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'García',
  displayName: 'Ana García',
  avatarUrl: null,
  bio: null,
  jobTitle: null,
  isOnline: true,
  lastSeenAt: null,
  createdAt: '2026-10-04T09:30:00.000Z',
  globalRole: 'USER',
  locale: 'en',
  timezone: 'Europe/Madrid',
  emailVerified: true,
  memberships: [
    {
      organizationId: ids.organization,
      organizationName: 'Acme',
      organizationSlug: 'acme',
      role: 'ORG_ADMIN',
    },
  ],
  permissions: [],
  pendingRoles: [],
};

const renewals = (calls: Call[]) =>
  calls.filter(
    (call) => call.method === 'POST' && call.path === '/auth/refresh',
  ).length;

async function goTo(route: string) {
  await act(async () => {
    window.location.hash = `#${route}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('la sesión al abrir la aplicación', () => {
  it('se renueva una vez al abrir, y no en cada navegación', async () => {
    document.cookie = 'hd_session=1';
    window.location.hash = '#tickets';
    const { calls } = mockApi({
      'POST /auth/refresh': {
        status: 200,
        body: { accessToken: 'token', user },
      },
    });

    render(<App />);
    await waitFor(() => expect(getAccessToken()).toBe('token'));
    expect(renewals(calls)).toBe(1);

    for (const route of ['people', 'organization', 'account', 'tickets'])
      await goTo(route);
    expect(renewals(calls)).toBe(1);
  });

  it('sin sesión, una ruta privada lleva al inicio de sesión sin pedir nada', async () => {
    window.location.hash = '#privacy-policy';
    const { calls } = mockApi({});

    render(<App />);
    await goTo('tickets');
    await waitFor(() => expect(window.location.hash).toBe('#login'));
    expect(renewals(calls)).toBe(0);
  });
});
