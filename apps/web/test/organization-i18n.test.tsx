import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { AdminAccessDenied } from '../src/features/admin/AdminAccessDenied';
import { OrganizationDialog } from '../src/features/organization/OrganizationDialog';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { OrganizationsPage } from '../src/features/organizations/OrganizationsPage';
import type { OrganizationSummary } from '../src/features/organizations/organizationsData';
import { OrganizationRolesPage } from '../src/features/roles/OrganizationRolesPage';
import { PlatformRolesPage } from '../src/features/roles/PlatformRolesPage';
import { mockApi, reply } from './support/api';
import {
  adminUser,
  ids,
  member,
  organizationReservation,
  page,
  viewerSession,
} from './support/fixtures';

/**
 * Las pantallas del bloque 2 en los tres idiomas.
 *
 * Los demás tests corren en inglés y comprueban que el inglés no cambió al
 * traducir. Éstos comprueban lo otro: que en castellano y en catalán no queda
 * ninguna clave cruda a la vista, y que la tabla de la organización cambia de
 * idioma con la aplicación abierta — sus filas se traducen al pintarse, no al
 * leerse de la API, que es justo lo que se rompe si alguien vuelve a guardar
 * el texto en la fila.
 */
const base = `/organizations/${ids.organization}`;
const CLAVE_CRUDA = /\b(organization|admin|common|errors)\.[a-zA-Z]+\./;

afterEach(async () => {
  await act(async () => {
    await i18next.changeLanguage('en');
  });
});

function api() {
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Acme Support',
      slug: 'acme-support',
      description: null,
      createdById: ids.admin,
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
        member({
          id: ids.agent,
          role: 'AGENT',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Singh',
        }),
      ],
    ),
    [`GET ${base}/role-grants`]: reply(
      'GET /organizations/{organizationId}/role-grants',
      200,
      [organizationReservation()],
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
          _count: { tickets: 1 },
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
    'GET /users': reply('GET /users', 200, page([adminUser()])),
    'GET /admin/role-grants': reply('GET /admin/role-grants', 200, []),
  });
}

async function idioma(lang: 'en' | 'es' | 'ca') {
  await act(async () => {
    await i18next.changeLanguage(lang);
  });
}

function organizacion(name = 'Acme Support') {
  return (
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
      organizationName={name}
      organizationRole="ORG_ADMIN"
    />
  );
}

describe('pantalla de la organización', () => {
  it('cambia de idioma con la aplicación abierta, filas incluidas', async () => {
    api();
    render(organizacion());
    const maya = await screen.findByRole('button', { name: 'Open Maya Singh' });
    expect(within(maya).getByText('Support agent')).toBeTruthy();
    expect(within(maya).getByText('Active')).toBeTruthy();
    // La reserva: espera a la cuenta.
    expect(screen.getByText('Waiting for the account')).toBeTruthy();

    await idioma('es');
    const mayaEs = screen.getByRole('button', { name: 'Abrir Maya Singh' });
    expect(within(mayaEs).getByText('Agente de soporte')).toBeTruthy();
    expect(within(mayaEs).getByText('Activo')).toBeTruthy();
    expect(screen.getByText('Esperando a la cuenta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Miembros' })).toBeTruthy();
    expect(screen.getByText('Herramientas de administración')).toBeTruthy();
    // Sin descripción escrita, la de reserva, traducida.
    expect(
      screen.getByText('Soporte y solicitudes de servicio de la organización.'),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);

    await idioma('ca');
    expect(
      within(screen.getByRole('button', { name: 'Obre Maya Singh' })).getByText(
        'Agent de suport',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);
  });

  it('las tres pestañas, en castellano, sin claves a la vista', async () => {
    await idioma('es');
    api();
    render(organizacion());
    await screen.findByText('Maya Singh');
    for (const pestaña of ['Roles de acceso', 'Categorías']) {
      act(() => screen.getByRole('button', { name: pestaña }).click());
      expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);
    }
    // La categoría cuenta TODOS sus tickets, y ya no lo llama «abiertos».
    expect(screen.getByText('TICKETS')).toBeTruthy();
    expect(screen.queryByText(/ABIERTOS/)).toBeNull();
    expect(screen.getAllByText('1 ticket').length).toBeGreaterThan(0);
  });

  it('todos los diálogos, en catalán, sin claves a la vista', async () => {
    await idioma('ca');
    const casos: Array<
      Pick<
        Parameters<typeof OrganizationDialog>[0],
        'deleteContext' | 'dialog' | 'selectedName'
      >
    > = [
      { deleteContext: null, dialog: 'add-member', selectedName: '' },
      { deleteContext: null, dialog: 'edit-member', selectedName: 'Maya' },
      { deleteContext: null, dialog: 'settings', selectedName: '' },
      { deleteContext: null, dialog: 'category', selectedName: '' },
      { deleteContext: null, dialog: 'category', selectedName: 'General' },
      { deleteContext: 'settings', dialog: 'delete', selectedName: '' },
      { deleteContext: 'edit-member', dialog: 'delete', selectedName: 'Maya' },
    ];
    for (const caso of casos) {
      const { unmount } = render(
        <OrganizationDialog
          {...caso}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onSave={vi.fn()}
          organizationDescription=""
          organizationName="Acme Support"
        />,
      );
      const dialogo = screen.getByRole('dialog');
      expect(dialogo.textContent, `${caso.dialog}`).not.toMatch(CLAVE_CRUDA);
      expect(within(dialogo).getByText('ORGANITZACIÓ')).toBeTruthy();
      unmount();
    }
  });
});

describe('lista de organizaciones', () => {
  const organizaciones: OrganizationSummary[] = [
    {
      counts: { members: 1, tickets: 3 },
      description: '',
      id: ids.organization,
      initials: 'AS',
      name: 'Acme Support',
      role: 'AGENT',
      slug: 'acme-support',
    },
    {
      counts: null,
      description: 'Ayuntamiento',
      id: 'otra',
      initials: 'VI',
      name: 'Vilanova',
      role: 'MEMBER',
      slug: 'vilanova',
    },
  ];

  it('rol, contadores y descripción, en castellano', async () => {
    await idioma('es');
    render(
      <OrganizationsPage
        onOpen={vi.fn()}
        onOrganizationsChanged={vi.fn()}
        organizations={organizaciones}
        viewer={viewerSession()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Tus organizaciones' }),
    ).toBeTruthy();
    expect(screen.getByText('2 organizaciones')).toBeTruthy();
    expect(screen.getByText('Agente de soporte')).toBeTruthy();
    expect(screen.getByText('1 miembro · 3 tickets')).toBeTruthy();
    expect(screen.getByText('Miembro')).toBeTruthy();
    expect(screen.getByText('Tu organización')).toBeTruthy();
    expect(
      screen.getByText('Soporte y solicitudes de servicio de la organización.'),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);
  });
});

describe('roles', () => {
  it('Roles y acceso: el nombre de la organización se ve tal cual, nunca como marcado', async () => {
    await idioma('es');
    api();
    const nombre = '<i>Acme</i> & Co';
    render(
      <OrganizationRolesPage
        canManage
        currentUserId={ids.admin}
        onAccessChanged={vi.fn()}
        onOpenOrganizations={vi.fn()}
        organizationId={ids.organization}
        organizationName={nombre}
        viewerRole="ORG_ADMIN"
      />,
    );
    await screen.findByText('Ana García (tú)');
    const fuerte = screen.getAllByText(nombre, { selector: 'strong' });
    expect(fuerte).toHaveLength(1);
    expect(document.querySelector('header i')).toBeNull();
    expect(fuerte[0]!.parentElement!.textContent).toMatch(
      /^Da roles en <i>Acme<\/i> & Co a una dirección de correo/,
    );
    expect(screen.getByText('Qué puede hacer cada rol')).toBeTruthy();
    expect(screen.getByText('Gestionar claves de API')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);
  });

  it('roles de plataforma y acceso restringido, en catalán', async () => {
    await idioma('ca');
    api();
    const { unmount } = render(<PlatformRolesPage currentUserId={ids.admin} />);
    expect(
      await screen.findByRole('heading', { name: 'Rols de la plataforma' }),
    ).toBeTruthy();
    expect(screen.getByText('Com funciona el vincle')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(CLAVE_CRUDA);
    unmount();

    render(<AdminAccessDenied onBack={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Accés restringit' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Torna a l’espai de treball' }),
    ).toBeTruthy();
  });
});
