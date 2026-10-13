import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationsPage } from '../src/features/organizations/OrganizationsPage';
import type { OrganizationSummary } from '../src/features/organizations/organizationsData';
import { apiError, mockApi, reply } from './support/api';
import { ids, viewerSession } from './support/fixtures';

/**
 * La lista de organizaciones y el alta de una nueva. Hasta el 13/10 no tenía
 * tests: crear una organización son dos llamadas —la organización y luego su
 * primer administrador por correo— y la segunda puede fallar sin que la
 * primera se deshaga, así que la pantalla tiene que decir exactamente qué
 * pasó.
 */
const NUEVA = '01a10720-0000-7000-8000-000000000001';

const acme: OrganizationSummary = {
  counts: { members: 3, tickets: 5 },
  description: 'Soporte de Acme',
  id: ids.organization,
  initials: 'AS',
  name: 'Acme Support',
  role: null,
  slug: 'acme-support',
};

const creada = {
  id: NUEVA,
  name: 'Helio Labs',
  slug: 'helio-labs',
  description: 'Laboratorio',
  createdById: ids.admin,
  myRole: null,
  createdAt: '2026-10-13T09:00:00.000Z',
  _count: { members: 0, tickets: 0, categories: 4 },
};

function pintar(isPlatformAdmin = true) {
  const onOrganizationsChanged = vi.fn();
  const onOpen = vi.fn();
  render(
    <OrganizationsPage
      isPlatformAdmin={isPlatformAdmin}
      onOpen={onOpen}
      onOrganizationsChanged={onOrganizationsChanged}
      organizations={[acme]}
      viewer={viewerSession()}
    />,
  );
  return { onOpen, onOrganizationsChanged };
}

function rellenar(name: string, email: string) {
  fireEvent.click(screen.getByRole('button', { name: 'New organization' }));
  const dialogo = screen.getByRole('dialog');
  fireEvent.change(within(dialogo).getByLabelText(/Organization name/), {
    target: { value: name },
  });
  fireEvent.change(within(dialogo).getByLabelText(/^Description/), {
    target: { value: 'Laboratorio' },
  });
  fireEvent.change(
    within(dialogo).getByLabelText(/Initial organization administrator/),
    { target: { value: email } },
  );
  return dialogo;
}

describe('lista de organizaciones', () => {
  it('sólo la vista de plataforma ofrece crear organizaciones', () => {
    pintar(false);
    expect(
      screen.getByRole('heading', { name: 'Your organizations' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'New organization' }),
    ).toBeNull();
  });

  it('busca por nombre y descripción, y dice cuando no hay nada', () => {
    pintar();
    expect(screen.getByText('1 organization')).toBeTruthy();
    expect(screen.getByText('3 members · 5 tickets')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search organizations'), {
      target: { value: 'nada que ver' },
    });
    expect(screen.getByText('No organizations found')).toBeTruthy();
    expect(screen.getByText('0 organizations')).toBeTruthy();
  });

  it('crea la organización y reserva su administración para el correo', async () => {
    const { calls } = mockApi({
      'POST /organizations': reply('POST /organizations', 201, creada),
      [`POST /organizations/${NUEVA}/role-grants`]: reply(
        'POST /organizations/{organizationId}/role-grants',
        201,
        {
          outcome: 'RESERVED',
          email: 'jefa@helio.example',
          role: 'ORG_ADMIN',
          user: null,
          reservation: {
            id: ids.reservation,
            organizationId: NUEVA,
            email: 'jefa@helio.example',
            role: 'ORG_ADMIN',
            waitingFor: 'ACCOUNT',
            grantedBy: {
              id: ids.admin,
              username: 'ana',
              displayName: 'Ana García',
            },
            createdAt: '2026-10-13T09:00:00.000Z',
            updatedAt: '2026-10-13T09:00:00.000Z',
          },
        },
      ),
    });
    const { onOrganizationsChanged } = pintar();
    const dialogo = rellenar('Helio Labs', 'Jefa@Helio.example');
    expect(within(dialogo).getByText('helpdesk.local/helio-labs')).toBeTruthy();
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create organization' }),
    );

    expect(
      await screen.findByText(
        'Helio Labs was created. Its administration is reserved for jefa@helio.example: it becomes active when that address creates its account and confirms it.',
      ),
    ).toBeTruthy();
    const escrituras = calls.filter((call) => call.method === 'POST');
    expect(escrituras.map((call) => call.path)).toEqual([
      '/organizations',
      `/organizations/${NUEVA}/role-grants`,
    ]);
    expect(escrituras[0]!.body).toEqual({
      description: 'Laboratorio',
      name: 'Helio Labs',
    });
    expect(escrituras[1]!.body).toEqual({
      email: 'jefa@helio.example',
      role: 'ORG_ADMIN',
    });
    expect(onOrganizationsChanged).toHaveBeenCalledWith(NUEVA);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un correo mal escrito o un nombre repetido no llegan a la API', () => {
    const { calls } = mockApi({});
    pintar();
    // El navegador da por buena una dirección sin dominio de primer nivel; el
    // esquema compartido —el mismo que aplica la API— no.
    let dialogo = rellenar('Helio Labs', 'jefa@helio');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create organization' }),
    );
    expect(
      within(dialogo).getByText(
        'Enter a valid e-mail address for the administrator.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancel' }));

    dialogo = rellenar('ACME support', 'jefa@acme.example');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create organization' }),
    );
    expect(
      within(dialogo).getByText(
        'An organization with this name or URL already exists.',
      ),
    ).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('el rechazo de la API sale traducido y el diálogo sigue abierto', async () => {
    mockApi({
      'POST /organizations': apiError(
        'POST /organizations',
        409,
        'ORG_SLUG_TAKEN',
        'That organization slug is already in use.',
      ),
    });
    pintar();
    const dialogo = rellenar('Helio Labs', 'jefa@helio.example');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create organization' }),
    );
    expect(
      await within(dialogo).findByText(
        'That organization address is already in use.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('si la organización se crea pero el administrador no, lo dice tal cual', async () => {
    mockApi({
      'POST /organizations': reply('POST /organizations', 201, creada),
      [`POST /organizations/${NUEVA}/role-grants`]: apiError(
        'POST /organizations/{organizationId}/role-grants',
        403,
        'RBAC_FORBIDDEN',
        'Your role is not allowed to invite a member.',
      ),
    });
    const { onOrganizationsChanged } = pintar();
    const dialogo = rellenar('Helio Labs', 'jefa@helio.example');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Create organization' }),
    );
    expect(
      await screen.findByText(
        'Helio Labs was created, but the administrator could not be assigned: Your role does not allow this. Assign it from Roles & access.',
      ),
    ).toBeTruthy();
    // La organización existe: la lista se relee igualmente.
    expect(onOrganizationsChanged).toHaveBeenCalledWith(NUEVA);
  });
});
