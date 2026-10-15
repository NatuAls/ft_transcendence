import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { AuditLogPage } from '../src/features/admin/AuditLogPage';
import {
  AUDIT_ACTION_GROUPS,
  auditActionKey,
} from '../src/features/admin/auditCatalog';
import { en } from '../src/core/i18n/locales/en';
import { mockApi, reply } from './support/api';
import { adminUser, ids, page } from './support/fixtures';

/**
 * El registro de auditoría (PR 2.4): quién hizo qué, cuándo y desde dónde,
 * con los filtros en la dirección y el antes y el después de cada entrada.
 */
const ENTRADA = '01a10740-0000-7000-8000-000000000001';
const OTRA = '01a10740-0000-7000-8000-000000000002';
const HUERFANA = '01a10740-0000-7000-8000-000000000003';

const entrada = (overrides: Record<string, unknown> = {}) => ({
  id: ENTRADA,
  action: 'user.role.changed',
  entity: 'User',
  entityId: ids.agent,
  ip: '83.45.120.10',
  createdAt: '2026-10-13T09:30:00.000Z',
  actor: { id: ids.admin, username: 'ana' },
  ...overrides,
});

const lista = [
  entrada(),
  entrada({
    id: OTRA,
    action: 'apiKey.created',
    entity: 'ApiKey',
    actor: { id: ids.member, username: 'jlee' },
    ip: null,
  }),
  entrada({
    id: HUERFANA,
    action: 'organization.deleted',
    entity: 'Organization',
    actor: null,
  }),
];

function api(
  extra: Parameters<typeof mockApi>[0] = {},
  meta = { total: lista.length, page: 1, take: 25, pages: 1 },
) {
  return mockApi({
    'GET /admin/audit-logs': reply('GET /admin/audit-logs', 200, {
      data: lista,
      meta,
    }),
    'GET /users': reply('GET /users', 200, page([adminUser()])),
    ...extra,
  });
}

function pintar(initialFilters = {}) {
  const onFiltersChange = vi.fn();
  render(
    <AuditLogPage
      initialFilters={initialFilters}
      onFiltersChange={onFiltersChange}
    />,
  );
  return { onFiltersChange };
}

// El nombre de una acción sale también en su filtro: se espera por la
// persona, que en el filtro lleva además su usuario.
const filas = async () => {
  await screen.findByText('Ana García');
  return screen.getAllByRole('listitem');
};

/** La última petición de la lista, como la recibió la API. */
const ultima = (calls: Array<{ path: string; query: URLSearchParams }>) =>
  calls.filter((call) => call.path === '/admin/audit-logs').at(-1)!.query;

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage('en');
  });
});

describe('registro de auditoría', () => {
  it('quién, qué, sobre qué, cuándo y desde dónde', async () => {
    api();
    pintar();
    const [primera, segunda, tercera] = await filas();
    // Con nombre si la cuenta está en la lista; si no, por su usuario.
    expect(within(primera!).getByText('Ana García')).toBeTruthy();
    expect(within(primera!).getByText('Account')).toBeTruthy();
    expect(within(primera!).getByText('83.45.120.10')).toBeTruthy();
    expect(within(primera!).getByText(/2026/)).toBeTruthy();
    expect(within(segunda!).getByText('@jlee')).toBeTruthy();
    expect(within(segunda!).getByText('API key created')).toBeTruthy();
    expect(within(segunda!).getByText('—')).toBeTruthy();
    // Sin autor: el sistema, o una cuenta que ya no existe.
    expect(
      within(tercera!).getByText('System or deleted account'),
    ).toBeTruthy();
    expect(screen.getByText(/3 entries/)).toBeTruthy();
  });

  it('cada filtro va a la API y a la dirección, y vuelve a la página 1', async () => {
    const { calls } = api();
    const { onFiltersChange } = pintar({ page: 2 });
    await filas();
    expect(ultima(calls).get('page')).toBe('2');

    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'user.role.changed' },
    });
    await vi.waitFor(() =>
      expect(ultima(calls).get('action')).toBe('user.role.changed'),
    );
    expect(ultima(calls).get('page')).toBe('1');
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      action: 'user.role.changed',
      actor: undefined,
      entity: undefined,
      from: undefined,
      page: undefined,
      to: undefined,
    });

    fireEvent.change(screen.getByLabelText('Affected'), {
      target: { value: 'ApiKey' },
    });
    fireEvent.change(screen.getByLabelText('Person'), {
      target: { value: ids.admin },
    });
    await vi.waitFor(() =>
      expect(ultima(calls).get('actorId')).toBe(ids.admin),
    );
    expect(ultima(calls).get('entity')).toBe('ApiKey');
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ actor: ids.admin, entity: 'ApiKey' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await vi.waitFor(() => expect(ultima(calls).get('action')).toBeNull());
    expect(ultima(calls).get('entity')).toBeNull();
  });

  it('«hasta el 14» incluye todo el 14 de quien mira, no hasta medianoche UTC', async () => {
    const { calls } = api();
    pintar();
    await filas();
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: '2026-10-14' },
    });
    await vi.waitFor(() => expect(ultima(calls).get('to')).not.toBeNull());
    const desde = new Date(ultima(calls).get('from')!);
    const hasta = new Date(ultima(calls).get('to')!);
    expect([desde.getFullYear(), desde.getMonth(), desde.getDate()]).toEqual([
      2026, 9, 1,
    ]);
    expect([desde.getHours(), desde.getMinutes()]).toEqual([0, 0]);
    expect([hasta.getMonth(), hasta.getDate(), hasta.getHours()]).toEqual([
      9, 14, 23,
    ]);
    expect(hasta.getMinutes()).toBe(59);
  });

  it('pagina con la API', async () => {
    const { calls } = api({}, { total: 60, page: 1, take: 25, pages: 3 });
    const { onFiltersChange } = pintar();
    await filas();
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Audit log pages' }),
      ).getByRole('button', { name: '2' }),
    );
    await vi.waitFor(() => expect(ultima(calls).get('page')).toBe('2'));
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: '2' }),
    );
  });

  it('una entrada se abre con su antes y su después, pedidos al abrirla y como texto', async () => {
    const { calls } = api({
      [`GET /admin/audit-logs/${ENTRADA}`]: reply(
        'GET /admin/audit-logs/{id}',
        200,
        {
          ...entrada(),
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          apiKeyId: null,
          before: { globalRole: 'USER', nota: '<b>no es HTML</b>' },
          after: { globalRole: 'GLOBAL_ADMIN' },
        },
      ),
    });
    pintar();
    const [primera] = await filas();
    expect(
      calls.some((call) => call.path.startsWith('/admin/audit-logs/')),
    ).toBe(false);
    fireEvent.click(within(primera!).getByText('Platform role changed'));
    // jsdom no dispara `toggle` al pulsar el resumen: se abre y se avisa.
    const detalles = primera!.querySelector('details')!;
    detalles.open = true;
    fireEvent(detalles, new Event('toggle'));

    expect(await within(primera!).findByText('Before')).toBeTruthy();
    const antes = within(primera!).getByText(/"globalRole": "USER"/);
    expect(antes.tagName).toBe('PRE');
    expect(antes.textContent).toContain('<b>no es HTML</b>');
    expect(antes.querySelector('b')).toBeNull();
    expect(
      within(primera!).getByText(/"globalRole": "GLOBAL_ADMIN"/),
    ).toBeTruthy();
    expect(
      within(primera!).getByText('Mozilla/5.0 (X11; Linux x86_64)'),
    ).toBeTruthy();
    expect(
      calls.filter((call) => call.path === `/admin/audit-logs/${ENTRADA}`),
    ).toHaveLength(1);
  });

  it('una acción que la pantalla aún no conoce se ve tal cual, no en blanco', async () => {
    mockApi({
      'GET /admin/audit-logs': reply('GET /admin/audit-logs', 200, {
        data: [entrada({ action: 'something.new' })],
        meta: { total: 1, page: 1, take: 25, pages: 1 },
      }),
      'GET /users': reply('GET /users', 200, page([])),
    });
    pintar();
    expect(await screen.findByText('something.new')).toBeTruthy();
  });

  it('en castellano, sin claves a la vista', async () => {
    await act(async () => {
      await i18next.changeLanguage('es');
    });
    api();
    pintar();
    expect(
      await screen.findByText('El sistema o una cuenta borrada'),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Registro de auditoría' }),
    ).toBeTruthy();
    // En la fila y en su filtro.
    expect(screen.getAllByText('Rol de plataforma cambiado')).toHaveLength(2);
    expect(screen.getByText(/3 entradas/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\b(admin|common)\.[a-zA-Z]+\./,
    );
  });
});

describe('el catálogo de acciones', () => {
  it('es el mismo que el de la API, y cada acción tiene su nombre', () => {
    const fuente = readFileSync(
      resolve(process.cwd(), '../api/src/modules/audit/audit.service.ts'),
      'utf8',
    );
    const union = fuente.slice(
      fuente.indexOf('export type AuditAction'),
      fuente.indexOf('export interface AuditContext'),
    );
    const api = [...union.matchAll(/\| '([a-zA-Z.]+)'/g)]
      .map((m) => m[1]!)
      .sort();
    const web = Object.values(AUDIT_ACTION_GROUPS).flat().sort();
    expect(api.length).toBeGreaterThan(15);
    expect(web).toEqual(api);
    const nombres = en.admin.audit.actions as Record<string, string>;
    expect(web.filter((action) => !nombres[auditActionKey(action)])).toEqual(
      [],
    );
  });
});
