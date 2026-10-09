import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * The organization screen of an ORG_ADMIN. Deleting the organization is
 * reserved by the API to whoever created it (or a platform administrator):
 * any other administrator used to be offered the button and only then told
 * no. The screen now reads who created it and offers it accordingly.
 */
const base = `/organizations/${ids.organization}`;

function api(createdById: string) {
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Acme Support',
      slug: 'acme-support',
      description: null,
      createdById,
      myRole: 'ORG_ADMIN',
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: 2, tickets: 4, categories: 1 },
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
      [
        {
          id: ids.reservation,
          name: 'General',
          color: '#0d6c90',
          description: null,
          isActive: true,
          _count: { tickets: 4 },
        },
      ],
    ),
    [`GET ${base}/stats`]: reply(
      'GET /organizations/{organizationId}/stats',
      200,
      {
        total: 4,
        unassigned: 1,
        byStatus: { OPEN: 2, IN_PROGRESS: 1, RESOLVED: 1 },
        byPriority: { MEDIUM: 4 },
        avgFirstResponseSeconds: 3600,
      },
    ),
  });
}

function renderPage(
  organizationRole: 'ORG_ADMIN' | 'GLOBAL_ADMIN' = 'ORG_ADMIN',
) {
  render(
    <OrganizationPage
      canManageCategories
      canManageMembers
      canManageOrganization
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
      organizationRole={organizationRole}
    />,
  );
}

async function openSettings() {
  await screen.findByText('Ana García');
  fireEvent.click(screen.getByRole('button', { name: 'Edit organization' }));
  return screen.findByRole('dialog');
}

describe('organization settings', () => {
  it('offer deleting the organization to the administrator who created it', async () => {
    api(ids.admin);
    renderPage();
    const dialog = await openSettings();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('do not offer it to another administrator, whom the API would refuse', async () => {
    api(ids.agent);
    renderPage();
    const dialog = await openSettings();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    ).toBeTruthy();
  });

  it('offer it to a platform administrator', async () => {
    api(ids.agent);
    renderPage('GLOBAL_ADMIN');
    const dialog = await openSettings();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});

/**
 * Nadie se encierra a sí mismo fuera de su propia organización.
 *
 * Pasó el 07/10 probando en local. Cambiar roles exige ser administrador de la
 * organización, así que una degradación propia NO TIENE VUELTA: quien se la
 * aplica queda dentro, sin poder gestionar nada y sin poder deshacerlo. El
 * límite del último administrador no cubría el caso —basta ascender a un
 * segundo administrador para que deje de aplicar—, y la pantalla ofrecía el
 * cambio sin un solo aviso.
 *
 * La API lo rechaza con `ORG_CANNOT_LOWER_OWN_ROLE`. Aquí se fija que la
 * pantalla, además, no lo ofrezca: cobrar el error después es peor que no
 * dejar pulsar.
 */
describe('tu propio acceso en la organización', () => {
  async function abrirMiFila(
    organizationRole: 'ORG_ADMIN' | 'GLOBAL_ADMIN' = 'ORG_ADMIN',
  ) {
    api(ids.admin);
    renderPage(organizationRole);
    // `currentUserId` es `ids.admin`, que en la lista es Ana García: su fila
    // soy yo.
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open Ana García' }),
    );
    return screen.findByRole('dialog');
  }

  /** El desplegable del rol, para preguntarle si está bloqueado. */
  const selectorDeRol = (dialog: HTMLElement) =>
    within(dialog).getByRole('combobox', {
      name: 'Organization role',
    }) as HTMLSelectElement;

  it('no deja cambiarte el rol a ti mismo, y dice por qué', async () => {
    const dialog = await abrirMiFila();
    expect(selectorDeRol(dialog).disabled).toBe(true);
    expect(within(dialog).getByText(/your own access/i)).toBeTruthy();
  });

  it('no ofrece quitarte a ti mismo desde la gestión de miembros', async () => {
    const dialog = await abrirMiFila();
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('el administrador de plataforma no se encierra: a él no se le limita', async () => {
    const dialog = await abrirMiFila('GLOBAL_ADMIN');
    expect(selectorDeRol(dialog).disabled).toBe(false);
  });
});
