import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { apiError, mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * Salir de una organización (PR 2.5).
 *
 * Cualquier miembro puede irse, menos el último administrador: la API lo
 * rechaza con un 403 de la política `member:leave`. La pantalla lo explica
 * antes de que lo intente —y no le ofrece un botón que se negará— y, si aun
 * así llega el rechazo, da el motivo en vez de «tu rol no lo permite».
 */
const base = `/organizations/${ids.organization}`;

const categories = reply(
  'GET /organizations/{organizationId}/categories',
  200,
  [
    {
      id: ids.reservation,
      name: 'General',
      color: '#0d6c90',
      description: null,
      isActive: true,
      _count: { tickets: 0 },
    },
  ],
);

/** Lo que lee un administrador: miembros, reservas, estadísticas, detalle. */
function adminApi(admins: string[], extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Acme Support',
      slug: 'acme-support',
      description: null,
      createdById: ids.primary,
      myRole: 'ORG_ADMIN',
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: 2, tickets: 0, categories: 1 },
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
        member({
          id: ids.agent,
          role: admins.includes(ids.agent) ? 'ORG_ADMIN' : 'AGENT',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Singh',
        }),
      ],
    ),
    [`GET ${base}/role-grants`]: reply(
      'GET /organizations/{organizationId}/role-grants',
      200,
      [],
    ),
    [`GET ${base}/categories`]: categories,
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
    ...extra,
  });
}

function pintar(
  props: Partial<Parameters<typeof OrganizationPage>[0]> = {},
  administra = true,
) {
  const onLeft = vi.fn();
  const onOrganizationsChanged = vi.fn();
  render(
    <OrganizationPage
      canLeave
      canManageCategories={administra}
      canManageMembers={administra}
      canManageOrganization={administra}
      canReadMembers={administra}
      canReadStats={administra}
      currentUserId={ids.admin}
      onAccessChanged={vi.fn()}
      onLeft={onLeft}
      onOpenCategory={vi.fn()}
      onOrganizationDeleted={vi.fn()}
      onOrganizationDescriptionChange={vi.fn()}
      onOrganizationNameChange={vi.fn()}
      onOrganizationsChanged={onOrganizationsChanged}
      organizationDescription=""
      organizationId={ids.organization}
      organizationName="Acme Support"
      organizationRole={administra ? 'ORG_ADMIN' : 'MEMBER'}
      {...props}
    />,
  );
  return { onLeft, onOrganizationsChanged };
}

const salir = () =>
  screen.getByRole('button', {
    name: 'Leave organization',
  }) as HTMLButtonElement;

describe('salir de una organización', () => {
  it('un miembro se va tras confirmar, y el armazón le lleva a otra parte', async () => {
    const { calls } = mockApi({
      [`GET ${base}/categories`]: categories,
      [`POST ${base}/leave`]: reply(
        'POST /organizations/{organizationId}/leave',
        204,
      ),
    });
    const { onLeft, onOrganizationsChanged } = pintar({}, false);
    await screen.findByText('General');
    expect(
      screen.getByRole('heading', { name: 'Leave Acme Support' }),
    ).toBeTruthy();

    // Pensárselo no cuesta nada: «Stay» cierra sin llamar a nadie.
    fireEvent.click(salir());
    let dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Leave Acme Support?')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    fireEvent.click(salir());
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Leave organization' }),
    );
    await vi.waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(onOrganizationsChanged).toHaveBeenCalledTimes(1);
    expect(
      calls.filter((call) => call.method === 'POST').map((call) => call.path),
    ).toEqual([`${base}/leave`]);
  });

  it('el único administrador ve por qué no puede irse, y no se le ofrece', async () => {
    const { calls } = adminApi([ids.admin]);
    pintar();
    await screen.findByText('Maya Singh');
    expect(
      screen.getByText(
        'You are its only administrator. Before leaving, make another member an administrator: an organization always keeps one.',
      ),
    ).toBeTruthy();
    expect(salir().disabled).toBe(true);
    fireEvent.click(salir());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('con otro administrador, el administrador sí puede irse', async () => {
    adminApi([ids.admin, ids.agent]);
    pintar();
    await screen.findByText('Maya Singh');
    expect(salir().disabled).toBe(false);
    expect(
      screen.getByText(/You lose access to its tickets right away/),
    ).toBeTruthy();
  });

  it('si la API lo niega igualmente, da el motivo y no «tu rol no lo permite»', async () => {
    // Otra sesión le quitó el rol al otro administrador mientras tanto.
    const { calls } = adminApi([ids.admin, ids.agent], {
      [`POST ${base}/leave`]: apiError(
        'POST /organizations/{organizationId}/leave',
        403,
        'RBAC_FORBIDDEN',
        'Your role is not allowed to leave the organization.',
      ),
    });
    const { onLeft, onOrganizationsChanged } = pintar();
    await screen.findByText('Maya Singh');
    fireEvent.click(salir());
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Leave organization',
      }),
    );
    // Con dos administradores en la lista, la sección no lo decía: lo que
    // sale ahora es el aviso del rechazo.
    expect(
      await screen.findByText(
        /You are its only administrator\. Before leaving/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Your role does not allow this.')).toBeNull();
    expect(onLeft).not.toHaveBeenCalled();
    expect(onOrganizationsChanged).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });

  it('quien no pertenece —un administrador de plataforma de paso— no tiene de dónde salir', async () => {
    adminApi([ids.admin]);
    pintar({ canLeave: false, isPlatformAdmin: true });
    await screen.findByText('Maya Singh');
    expect(
      screen.queryByRole('button', { name: 'Leave organization' }),
    ).toBeNull();
  });
});
