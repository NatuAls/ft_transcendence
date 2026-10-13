import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * La pantalla de la organización se mantiene al día sola (R9).
 *
 * Sin tiempo real, quien tenía abierta la pestaña de miembros no veía llegar a
 * nadie hasta recargar a mano, y era fácil pensar que la persona recién
 * añadida se había perdido. Lo que se fija aquí son las tres decisiones que
 * tiene el cableado y que es fácil equivocar:
 *
 *   · un evento de la organización activa recarga,
 *   · uno de OTRA organización a la que también perteneces NO recarga
 *     (los eventos llegan a la sala `org:<id>`, y puedes estar en varias),
 *   · si el que sale eres TÚ, lo que cambia son tus permisos, no una lista.
 */
const OTRA = '01a1131c-2251-735c-bddc-dc95224c6fec';

/** Los escuchadores que registra la pantalla, por nombre de evento. */
const escuchas = new Map<string, Array<(payload: unknown) => void>>();

vi.mock('../src/core/realtime/socket', async () => {
  const real = await vi.importActual<
    typeof import('../src/core/realtime/socket')
  >('../src/core/realtime/socket');
  return {
    ...real,
    connectRealtime: vi.fn(),
    onRealtime: (event: string, handler: (payload: unknown) => void) => {
      const lista = escuchas.get(event) ?? [];
      lista.push(handler);
      escuchas.set(event, lista);
      return () => {
        escuchas.set(
          event,
          (escuchas.get(event) ?? []).filter((item) => item !== handler),
        );
      };
    },
  };
});

const { OrganizationPage } =
  await import('../src/features/organization/OrganizationPage');
const { RealtimeEvents } = await import('../src/core/realtime/socket');

function emitir(event: string, payload: unknown) {
  for (const handler of escuchas.get(event) ?? []) handler(payload);
}

function rutas(miembros: string[]) {
  const base = `/organizations/${ids.organization}`;
  return {
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Vilanova',
      slug: 'vilanova',
      description: null,
      createdById: ids.admin,
      myRole: 'ORG_ADMIN' as const,
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: miembros.length, tickets: 0, categories: 0 },
    }),
    [`GET ${base}/members`]: reply(
      'GET /organizations/{organizationId}/members',
      200,
      miembros.map((nombre, indice) =>
        member({
          id:
            indice === 0
              ? ids.admin
              : `01a1131b-d3f7-77ae-ab6b-4a60e6af4f3${indice}`,
          role: indice === 0 ? 'ORG_ADMIN' : 'MEMBER',
          username: nombre.toLowerCase().replace(/\s+/g, '.'),
          displayName: nombre,
        }),
      ),
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
  };
}

function pintar(onAccessChanged = vi.fn()) {
  render(
    <OrganizationPage
      canManageCategories
      canManageMembers
      canManageOrganization
      canReadMembers
      canReadStats
      currentUserId={ids.admin}
      onAccessChanged={onAccessChanged}
      onOpenCategory={vi.fn()}
      onOrganizationDeleted={vi.fn()}
      onOrganizationDescriptionChange={vi.fn()}
      onOrganizationNameChange={vi.fn()}
      onOrganizationsChanged={vi.fn()}
      organizationDescription=""
      organizationId={ids.organization}
      organizationName="Vilanova"
      organizationRole="ORG_ADMIN"
    />,
  );
  return onAccessChanged;
}

describe('la organización al día sin recargar', () => {
  beforeEach(() => {
    escuchas.clear();
  });

  it('enseña a quien acaba de entrar, sin que nadie recargue la página', async () => {
    let miembros = ['Marta Rius'];
    const base = `/organizations/${ids.organization}`;
    mockApi({
      ...rutas(miembros),
      // El segundo paso por la lista ya trae al nuevo.
      [`GET ${base}/members`]: () => {
        const actual = rutas(miembros)[`GET ${base}/members`];
        return actual as ReturnType<typeof reply>;
      },
    });

    pintar();
    expect(await screen.findByText('Marta Rius')).toBeTruthy();
    expect(screen.queryByText('Bru Mestre')).toBeNull();

    miembros = ['Marta Rius', 'Bru Mestre'];
    await act(async () => {
      emitir(RealtimeEvents.memberAdded, {
        member: { organizationId: ids.organization, user: { id: 'otro' } },
      });
    });

    expect(await screen.findByText('Bru Mestre')).toBeTruthy();
  });

  it('ignora lo que pasa en otra organización a la que también perteneces', async () => {
    const { calls } = mockApi(rutas(['Marta Rius']));
    pintar();
    await screen.findByText('Marta Rius');
    const antes = calls.length;

    await act(async () => {
      emitir(RealtimeEvents.memberAdded, {
        member: { organizationId: OTRA, user: { id: 'otro' } },
      });
      emitir(RealtimeEvents.categoryCreated, { organizationId: OTRA });
    });

    expect(calls.length).toBe(antes);
  });

  it('si el que sale eres tú, relee la sesión en vez de la lista', async () => {
    mockApi(rutas(['Marta Rius']));
    const onAccessChanged = pintar();
    await screen.findByText('Marta Rius');

    await act(async () => {
      emitir(RealtimeEvents.memberRemoved, {
        organizationId: ids.organization,
        userId: ids.admin,
      });
    });

    await waitFor(() => expect(onAccessChanged).toHaveBeenCalled());
  });

  it('tras reconectar recarga, porque mientras no había socket pudo cambiar todo', async () => {
    const { calls } = mockApi(rutas(['Marta Rius']));
    pintar();
    await screen.findByText('Marta Rius');
    const antes = calls.length;

    await act(async () => {
      emitir(RealtimeEvents.connected, {});
    });

    await waitFor(() => expect(calls.length).toBeGreaterThan(antes));
  });
});
