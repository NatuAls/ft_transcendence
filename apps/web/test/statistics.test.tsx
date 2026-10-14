import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import i18next from 'i18next';
import { GlobalAdminPage } from '../src/features/admin/GlobalAdminPage';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { useVisibleInterval } from '../src/core/async/useVisibleInterval';
import { formatDuration } from '../src/core/i18n/duration';
import { mockApi, reply } from './support/api';
import { adminUser, ids, member, page } from './support/fixtures';

/**
 * Estadísticas (PR 2.3): las de la organización y las de la plataforma, con
 * «Actualizar» y refresco cada minuto con la pestaña a la vista (R14).
 */
const base = `/organizations/${ids.organization}`;

const cifras = (overrides: Record<string, unknown> = {}) => ({
  total: 10,
  unassigned: 2,
  byStatus: { OPEN: 4, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 1 },
  byPriority: { LOW: 2, MEDIUM: 5, HIGH: 3 },
  avgFirstResponseSeconds: 8_100,
  ...overrides,
});

function organizationApi(stats: () => Record<string, unknown>) {
  return mockApi({
    [`GET ${base}/members`]: reply(
      'GET /organizations/{organizationId}/members',
      200,
      [
        member({
          id: ids.admin,
          role: 'ORG_ADMIN',
          username: 'ana',
          displayName: 'Ana García',
        }),
      ],
    ),
    [`GET ${base}/role-grants`]: reply(
      'GET /organizations/{organizationId}/role-grants',
      200,
      [],
    ),
    [`GET ${base}/categories`]: reply(
      'GET /organizations/{organizationId}/categories',
      200,
      [],
    ),
    [`GET ${base}/stats`]: () =>
      reply('GET /organizations/{organizationId}/stats', 200, stats()),
  });
}

function organizacion() {
  render(
    <OrganizationPage
      canManageCategories={false}
      canManageMembers
      canManageOrganization={false}
      canReadMembers
      canReadStats
      currentUserId={ids.admin}
      onAccessChanged={vi.fn()}
      onOpenCategory={vi.fn()}
      onOrganizationDeleted={vi.fn()}
      onOrganizationDescriptionChange={vi.fn()}
      onOrganizationNameChange={vi.fn()}
      onOrganizationsChanged={vi.fn()}
      organizationDescription=""
      organizationId={ids.organization}
      organizationName="Acme Support"
      organizationRole="ORG_ADMIN"
    />,
  );
}

const panel = async () =>
  (await screen.findByRole('heading', { name: 'Tickets in numbers' })).closest(
    'section',
  )!;

/** El valor que acompaña a una etiqueta de la lista de cifras. */
const cifra = (dentro: HTMLElement, etiqueta: string) =>
  within(dentro).getByText(etiqueta).nextElementSibling?.textContent;

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => {
    await i18next.changeLanguage('en');
  });
});

describe('estadísticas de la organización', () => {
  it('cifras, tiempo medio de primera respuesta y reparto por estado y prioridad', async () => {
    organizationApi(() => cifras());
    organizacion();
    const zona = await panel();
    expect(cifra(zona, 'All tickets')).toBe('10');
    expect(cifra(zona, 'Open or in progress, without an agent')).toBe('2');
    expect(cifra(zona, 'Average first response')).toBe('2 hr, 15 min');
    // Las mismas palabras que la lista de tickets.
    const estados = within(zona).getByText('By status').parentElement!;
    expect(
      within(estados).getByText('Open').nextElementSibling?.textContent,
    ).toBe('4');
    expect(
      within(estados).getByText('In progress').nextElementSibling?.textContent,
    ).toBe('3');
    const prioridades = within(zona).getByText('By priority').parentElement!;
    expect(
      within(prioridades).getByText('High').nextElementSibling?.textContent,
    ).toBe('3');
    // Y la tarjeta de arriba cuenta lo mismo que el panel: sólo OPEN.
    const tarjeta = screen.getByText('Open tickets').closest('article')!;
    expect(within(tarjeta).getByText('4')).toBeTruthy();
  });

  it('sin respuestas todavía no dice «0 segundos»', async () => {
    organizationApi(() => cifras({ avgFirstResponseSeconds: 0 }));
    organizacion();
    const zona = await panel();
    expect(cifra(zona, 'Average first response')).toBe('No first replies yet');
  });

  it('«Refresh» vuelve a pedir las cifras y las cambia', async () => {
    let abiertos = 4;
    const { calls } = organizationApi(() =>
      cifras({
        byStatus: { OPEN: abiertos, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 1 },
      }),
    );
    organizacion();
    const zona = await panel();
    expect(
      within(zona).getByText(/^Updated .+ · refreshed every minute$/),
    ).toBeTruthy();
    abiertos = 9;
    fireEvent.click(within(zona).getByRole('button', { name: 'Refresh' }));
    const tarjeta = screen.getByText('Open tickets').closest('article')!;
    expect(await within(tarjeta).findByText('9')).toBeTruthy();
    expect(calls.filter((call) => call.path === `${base}/stats`)).toHaveLength(
      2,
    );
    // Sólo las cifras: miembros y categorías no se recargan con ellas.
    expect(
      calls.filter((call) => call.path === `${base}/members`),
    ).toHaveLength(1);
  });

  it('mientras llegan, la tarjeta no inventa un 0', async () => {
    let soltar: () => void = () => {};
    const espera = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    mockApi({
      [`GET ${base}/members`]: reply(
        'GET /organizations/{organizationId}/members',
        200,
        [],
      ),
      [`GET ${base}/role-grants`]: reply(
        'GET /organizations/{organizationId}/role-grants',
        200,
        [],
      ),
      [`GET ${base}/categories`]: reply(
        'GET /organizations/{organizationId}/categories',
        200,
        [],
      ),
      [`GET ${base}/stats`]: async () => {
        await espera;
        return reply(
          'GET /organizations/{organizationId}/stats',
          200,
          cifras(),
        );
      },
    });
    organizacion();
    const tarjeta = (await screen.findByText('Open tickets')).closest(
      'article',
    )!;
    expect(within(tarjeta).getByText('—')).toBeTruthy();
    await act(async () => soltar());
    expect(await within(tarjeta).findByText('4')).toBeTruthy();
  });
});

describe('estadísticas de la plataforma', () => {
  it('cuenta con la API, no con la página de usuarios, y dice qué es «abierto»', async () => {
    const { calls } = mockApi({
      'GET /users': reply('GET /users', 200, page([adminUser()])),
      'GET /admin/role-grants': reply('GET /admin/role-grants', 200, []),
      'GET /admin/stats': reply('GET /admin/stats', 200, {
        users: 240,
        activeUsers: 231,
        organizations: 12,
        tickets: 1830,
        openTickets: 97,
        messages: 5120,
        attachments: 310,
      }),
    });
    render(<GlobalAdminPage currentUserId={ids.admin} organizations={[]} />);
    const actividad = (
      await screen.findByRole('heading', { name: 'Platform activity' })
    ).closest('section')!;
    expect(cifra(actividad, 'Tickets')).toBe('1830');
    expect(cifra(actividad, 'Open or in progress')).toBe('97');
    expect(cifra(actividad, 'Chat messages')).toBe('5120');
    expect(cifra(actividad, 'Attachments')).toBe('310');
    // La lista trae una cuenta; la plataforma tiene 240.
    const cuentas = screen.getByText('Accounts').closest('article')!;
    expect(within(cuentas).getByText('240')).toBeTruthy();
    fireEvent.click(within(actividad).getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() =>
      expect(calls.filter((call) => call.path === '/admin/stats')).toHaveLength(
        2,
      ),
    );
  });
});

describe('refresco periódico (R14)', () => {
  it('cada minuto con la pestaña a la vista, nunca con ella oculta', () => {
    vi.useFakeTimers();
    let estado: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => estado,
    });
    const refrescar = vi.fn();
    const { unmount } = renderHook(() => useVisibleInterval(refrescar, 60_000));
    vi.advanceTimersByTime(59_999);
    expect(refrescar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refrescar).toHaveBeenCalledTimes(1);
    estado = 'hidden';
    vi.advanceTimersByTime(180_000);
    expect(refrescar).toHaveBeenCalledTimes(1);
    estado = 'visible';
    vi.advanceTimersByTime(60_000);
    expect(refrescar).toHaveBeenCalledTimes(2);
    unmount();
    vi.advanceTimersByTime(600_000);
    expect(refrescar).toHaveBeenCalledTimes(2);
    // Vuelve el getter del navegador.
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  it('nunca por debajo de 30 s, y apagado no llama', () => {
    vi.useFakeTimers();
    const rapido = vi.fn();
    renderHook(() => useVisibleInterval(rapido, 1_000));
    vi.advanceTimersByTime(29_000);
    expect(rapido).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(rapido).toHaveBeenCalledTimes(1);

    const apagado = vi.fn();
    renderHook(() => useVisibleInterval(apagado, 60_000, false));
    vi.advanceTimersByTime(600_000);
    expect(apagado).not.toHaveBeenCalled();
  });
});

describe('duraciones', () => {
  it('las dos unidades mayores, en el idioma de la interfaz', () => {
    expect(formatDuration(8_100, 'en')).toBe('2 hr, 15 min');
    expect(formatDuration(8_100, 'es')).toBe('2 h y 15 min');
    expect(formatDuration(8_100, 'ca')).toBe('2 h i 15 min');
    expect(formatDuration(45, 'en')).toBe('45 sec');
    expect(formatDuration(2 * 86_400 + 3 * 3_600 + 59, 'en')).toBe(
      '2 days, 3 hr',
    );
    expect(formatDuration(7_200, 'en')).toBe('2 hr');
  });

  it('sin Intl.DurationFormat, una unidad tras otra', () => {
    const original = (Intl as unknown as { DurationFormat?: unknown })
      .DurationFormat;
    Object.defineProperty(Intl, 'DurationFormat', {
      configurable: true,
      value: undefined,
    });
    try {
      expect(formatDuration(8_100, 'en')).toBe('2 hr 15 min');
      expect(formatDuration(8_100, 'es')).toBe('2 h 15 min');
    } finally {
      Object.defineProperty(Intl, 'DurationFormat', {
        configurable: true,
        value: original,
      });
    }
  });
});
