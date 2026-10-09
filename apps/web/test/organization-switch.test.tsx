import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * Cambiar de organización tiene que cambiar lo que se ve.
 *
 * El síntoma del 06/10: al elegir otra organización en el selector, la
 * pantalla seguía enseñando los miembros de la anterior. Esta prueba fija el
 * contrato por el lado que importa — a QUÉ organización se le piden los datos
 * y QUÉ se pinta — para las dos formas en que puede ocurrir el cambio: con
 * `key` (el armazón remonta la pantalla) y sin él (sólo cambia la prop).
 */
const ORG_A = ids.organization;
const ORG_B = '01a1131c-0c9e-718d-bd7b-b19c5541de49';

function organizacion(id: string, nombre: string, miembro: string) {
  const base = `/organizations/${id}`;
  return {
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id,
      name: nombre,
      slug: nombre.toLowerCase().replace(/\s+/g, '-'),
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
          username: miembro.toLowerCase(),
          displayName: miembro,
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
  };
}

function pintar(organizationId: string, organizationName: string) {
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
      organizationId={organizationId}
      organizationName={organizationName}
      organizationRole="ORG_ADMIN"
    />
  );
}

describe('cambiar de organización', () => {
  it('pide los datos de la organización que se elige, no de la anterior', async () => {
    const { calls } = mockApi({
      ...organizacion(ORG_A, 'Vilanova', 'Ana Garcia'),
      ...organizacion(ORG_B, 'Consell Comarcal', 'Bru Mestre'),
    });

    const { rerender } = render(pintar(ORG_A, 'Vilanova'));
    expect(await screen.findByText('Ana Garcia')).toBeTruthy();

    // El armazón cambia la prop; con `key` además remonta, pero la pantalla
    // tiene que responder igual aunque sólo cambie la prop.
    rerender(pintar(ORG_B, 'Consell Comarcal'));

    expect(await screen.findByText('Bru Mestre')).toBeTruthy();
    expect(screen.queryByText('Ana Garcia')).toBeNull();

    await waitFor(() =>
      expect(
        calls.some((c) => c.path === `/organizations/${ORG_B}/members`),
      ).toBe(true),
    );
  });

  it('no mezcla: cada organización recibe sus propias peticiones', async () => {
    const { calls } = mockApi({
      ...organizacion(ORG_A, 'Vilanova', 'Ana Garcia'),
      ...organizacion(ORG_B, 'Consell Comarcal', 'Bru Mestre'),
    });

    const { rerender } = render(pintar(ORG_A, 'Vilanova'));
    await screen.findByText('Ana Garcia');
    rerender(pintar(ORG_B, 'Consell Comarcal'));
    await screen.findByText('Bru Mestre');

    const deB = calls.filter((c) => c.path.includes(ORG_B));
    const deA = calls.filter((c) => c.path.includes(ORG_A));
    expect(deA.length).toBeGreaterThan(0);
    expect(deB.length).toBeGreaterThan(0);
    // Y ninguna petición de B puede haberse hecho con el id de A.
    expect(deB.every((c) => !c.path.includes(ORG_A))).toBe(true);
  });
});
