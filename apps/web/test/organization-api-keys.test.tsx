import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * Claves de la API pública (PR 2.2).
 *
 * Lo que de verdad importa es el secreto: viaja una sola vez, en la respuesta
 * de crear la clave, y la pantalla tiene que enseñarlo una sola vez — que
 * desaparezca al cerrar, y que no quede en ningún sitio: ni en el
 * almacenamiento del navegador ni en la dirección.
 */
const base = `/organizations/${ids.organization}`;
const KEY = '01a10730-0000-7000-8000-000000000001';
const REVOCADA = '01a10730-0000-7000-8000-000000000002';
const NUEVA = '01a10730-0000-7000-8000-000000000003';
// Tiene la forma de las de verdad, hdl_live_<prefijo>.<resto>, pero la API no
// la ha emitido nunca y no abre nada. Se monta por trozos para que el escáner
// de secretos del CI no la tome por una clave real: escrita de una pieza, lo
// parecía.
const SECRETO =
  ['hdl', 'live', 'c0ffee00'].join('_') + '.inventada-para-este-test';

const clave = (overrides: Record<string, unknown> = {}) => ({
  id: KEY,
  name: 'Status page',
  prefix: 'a1b2c3d4',
  scopes: ['tickets:read', 'stats:read'],
  rateLimitPerMinute: 60,
  lastUsedAt: null,
  expiresAt: '2027-01-11T09:00:00.000Z',
  revokedAt: null,
  createdAt: '2026-10-13T09:00:00.000Z',
  createdBy: { username: 'ana' },
  ...overrides,
});

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  let lista = [
    clave(),
    clave({
      id: REVOCADA,
      name: 'Old integration',
      prefix: 'deadbeef',
      revokedAt: '2026-10-12T09:00:00.000Z',
      lastUsedAt: '2026-10-11T09:00:00.000Z',
    }),
  ];
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Acme Support',
      slug: 'acme-support',
      description: null,
      createdById: ids.admin,
      myRole: 'ORG_ADMIN',
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: 1, tickets: 0, categories: 0 },
    }),
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
    [`GET ${base}/stats`]: reply(
      'GET /organizations/{organizationId}/stats',
      200,
      {
        total: 0,
        unassigned: 0,
        byStatus: {},
        byPriority: {},
        avgFirstResponseSeconds: 0,
      },
    ),
    [`GET ${base}/api-keys`]: () =>
      reply('GET /organizations/{organizationId}/api-keys', 200, lista),
    [`POST ${base}/api-keys`]: () => {
      lista = [
        clave({
          id: NUEVA,
          name: 'Zapier',
          prefix: 'c0ffee00',
          scopes: ['tickets:write'],
        }),
        ...lista,
      ];
      return reply('POST /organizations/{organizationId}/api-keys', 201, {
        id: NUEVA,
        name: 'Zapier',
        prefix: 'c0ffee00',
        scopes: ['tickets:write'],
        expiresAt: '2027-01-11T09:00:00.000Z',
        createdAt: '2026-10-13T09:00:00.000Z',
        secret: SECRETO,
      });
    },
    ...extra,
  });
}

function pintar(administra = true) {
  render(
    <OrganizationPage
      canManageApiKeys={administra}
      canManageCategories={administra}
      canManageMembers={administra}
      canManageOrganization={administra}
      canReadMembers={administra}
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
      organizationRole={administra ? 'ORG_ADMIN' : 'AGENT'}
    />,
  );
}

async function abrirPestaña() {
  fireEvent.click(await screen.findByRole('button', { name: 'API keys' }));
  return screen.findByText('Status page');
}

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage('en');
  });
});

describe('claves de API', () => {
  it('lista las claves con sus permisos, caducidad y uso, sin secretos', async () => {
    api();
    pintar();
    await abrirPestaña();
    const fila = screen.getByText('Status page').closest('li')!;
    expect(within(fila).getByText('Active')).toBeTruthy();
    expect(within(fila).getByText('hdl_live_a1b2c3d4…')).toBeTruthy();
    expect(within(fila).getByText('Read tickets')).toBeTruthy();
    expect(within(fila).getByText('Read statistics')).toBeTruthy();
    expect(within(fila).getByText('Never used')).toBeTruthy();
    expect(within(fila).getByText(/^Expires /)).toBeTruthy();
    // La revocada se ve como tal y ya no ofrece revocar.
    const vieja = screen.getByText('Old integration').closest('li')!;
    expect(within(vieja).getByText('Revoked')).toBeTruthy();
    expect(within(vieja).queryByRole('button')).toBeNull();
    // Cómo se usa, y dónde está la referencia de la API pública.
    const enlace = screen.getByRole('link', { name: 'Public API reference' });
    expect(enlace.getAttribute('href')).toBe('/api/v1/docs');
    expect(enlace.getAttribute('rel')).toContain('noopener');
  });

  it('crear sin permisos no llega a la API y dice qué falta', async () => {
    const { calls } = api();
    pintar();
    await abrirPestaña();
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Name'), {
      target: { value: 'ab' },
    });
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create key' }),
    );
    expect(
      within(dialogo).getByText('Choose at least one permission.'),
    ).toBeTruthy();
    expect(within(dialogo).getByText('This value is too short.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('el secreto se ve una sola vez: aparece al crear y desaparece al cerrar', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escribir },
    });
    const { calls } = api();
    pintar();
    await abrirPestaña();
    const direccion = window.location.href;

    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Name'), {
      target: { value: 'Zapier' },
    });
    fireEvent.click(
      within(dialogo).getByLabelText(/Create and change tickets/),
    );
    fireEvent.change(within(dialogo).getByLabelText('Expires'), {
      target: { value: '30' },
    });
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create key' }),
    );

    const secreto = await screen.findByDisplayValue(SECRETO);
    expect(screen.getByText('Copy the key now')).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')!.body).toEqual({
      name: 'Zapier',
      scopes: ['tickets:write'],
      expiresInDays: 30,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(escribir).toHaveBeenCalledWith(SECRETO);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(secreto).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'I have stored it' }));
    // Se fue: ni en la pantalla, ni en el almacenamiento, ni en la dirección.
    expect(screen.queryByDisplayValue(SECRETO)).toBeNull();
    expect(document.body.innerHTML).not.toContain(SECRETO);
    expect(JSON.stringify({ ...localStorage })).not.toContain(SECRETO);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRETO);
    expect(window.location.href).toBe(direccion);
    // La lista ya trae la clave nueva, por su prefijo.
    expect(await screen.findByText('hdl_live_c0ffee00…')).toBeTruthy();
  });

  it('si no se puede copiar, lo dice y deja el secreto seleccionado para copiarlo a mano', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    api();
    pintar();
    await abrirPestaña();
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Name'), {
      target: { value: 'Zapier' },
    });
    fireEvent.click(
      within(dialogo).getByLabelText(/Create and change tickets/),
    );
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create key' }),
    );
    await screen.findByDisplayValue(SECRETO);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(
      screen.getByText(
        'It could not be copied here: select it and copy it by hand.',
      ),
    ).toBeTruthy();
  });

  it('revocar pide confirmación, y «mantener» no llama a nadie', async () => {
    const { calls } = api({
      [`DELETE ${base}/api-keys/${KEY}`]: reply(
        'DELETE /organizations/{organizationId}/api-keys/{id}',
        204,
      ),
    });
    pintar();
    await abrirPestaña();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Status page' }));
    let dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Revoke Status page?')).toBeTruthy();
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Keep the key' }),
    );
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Status page' }));
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Revoke key' }),
    );
    expect(await screen.findByText('Status page was revoked.')).toBeTruthy();
    expect(
      calls.filter((call) => call.method === 'DELETE').map((call) => call.path),
    ).toEqual([`${base}/api-keys/${KEY}`]);
  });

  it('un agente no ve la pestaña', async () => {
    api();
    pintar(false);
    await screen.findByText('Support agents');
    expect(screen.queryByRole('button', { name: 'API keys' })).toBeNull();
  });

  it('en castellano, sin claves de traducción a la vista', async () => {
    await act(async () => {
      await i18next.changeLanguage('es');
    });
    api();
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Claves de API' }),
    );
    await screen.findByText('Status page');
    // Las dos claves de la lista leen tickets.
    expect(screen.getAllByText('Leer tickets')).toHaveLength(2);
    expect(screen.getByText('Revocada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear clave' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Crear una clave de API')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\b(organization|common|errors)\.[a-zA-Z]+\./,
    );
  });
});
