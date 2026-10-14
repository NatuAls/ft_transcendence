import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * La costura entre la pantalla de la organización y la lista de tickets.
 *
 * Las dos pantallas tenían sus propias pruebas, todas en verde, y aun así se
 * rompían al pasar de una a otra — lo vio Nahuel el 13/10 al usarlas juntas:
 *
 *   · Pulsar una categoría llevaba a `#tickets?category=General`: el NOMBRE.
 *     La lista filtra por `categoryId` contra la API, que esperaba un UUID y
 *     respondía 400 («Could not load tickets»). Cada pantalla, por separado,
 *     hacía bien lo suyo; nadie probaba que lo que sale de una sea lo que
 *     entiende la otra.
 *   · «Open tickets» decía 7 donde la lista decía «Open: 6». Los datos eran
 *     los mismos —6 abiertos y 1 en curso—, pero aquí se sumaban los dos y
 *     allí no: la misma palabra contaba dos cosas.
 *
 * Esto fija los dos contratos desde este lado: qué se le entrega a la lista,
 * y que «abierto» quiere decir lo mismo en las dos.
 */
const base = `/organizations/${ids.organization}`;
const CATEGORIA_ID = '01a120a3-d440-741e-a87f-577fa82191c1';

function api(byStatus: Record<string, number>) {
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Ajuntament de Badalona',
      slug: 'badalona',
      description: null,
      createdById: ids.admin,
      myRole: 'ORG_ADMIN',
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: 1, tickets: 8, categories: 1 },
    }),
    [`GET ${base}/members`]: reply(
      'GET /organizations/{organizationId}/members',
      200,
      [member({ id: ids.admin, role: 'ORG_ADMIN', displayName: 'Ana García' })],
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
          id: CATEGORIA_ID,
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
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        unassigned: 0,
        byStatus,
        byPriority: {},
        avgFirstResponseSeconds: 0,
      },
    ),
  });
}

function pintar(onOpenCategory = vi.fn()) {
  render(
    <OrganizationPage
      canManageCategories
      canManageMembers
      canManageOrganization
      canReadMembers
      canReadStats
      currentUserId={ids.admin}
      onAccessChanged={vi.fn()}
      onOpenCategory={onOpenCategory}
      onOrganizationDeleted={vi.fn()}
      onOrganizationDescriptionChange={vi.fn()}
      onOrganizationNameChange={vi.fn()}
      onOrganizationsChanged={vi.fn()}
      organizationDescription=""
      organizationId={ids.organization}
      organizationName="Ajuntament de Badalona"
      organizationRole="ORG_ADMIN"
    />,
  );
  return onOpenCategory;
}

describe('de la organización a la lista de tickets', () => {
  it('una categoría lleva a la lista con su ID, que es lo que la API entiende', async () => {
    api({ OPEN: 1 });
    const onOpenCategory = pintar();
    await screen.findByText('Ana García');

    fireEvent.click(screen.getByRole('button', { name: 'Categories' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'View tickets in General' }),
    );

    expect(onOpenCategory).toHaveBeenCalledWith(CATEGORIA_ID);
    // El fallo concreto: con el nombre, la API responde 400.
    expect(onOpenCategory).not.toHaveBeenCalledWith('General');
  });

  it('«Open tickets» cuenta lo mismo que la tarjeta «Open» de la lista', async () => {
    // El caso de Nahuel: 6 abiertos, 1 en curso, 1 resuelto.
    api({ OPEN: 6, IN_PROGRESS: 1, RESOLVED: 1 });
    pintar();
    await screen.findByText('Ana García');

    const tarjeta = screen.getByText('Open tickets').closest('article')!;
    // La lista enseña «Open: 6» y aparte «In progress: 1». Las cifras llegan
    // por su cuenta (se refrescan solas), así que se esperan.
    expect(await within(tarjeta).findByText('6')).toBeTruthy();
    // Antes: 7, porque sumaba el que está en curso.
    expect(within(tarjeta).queryByText('7')).toBeNull();
  });

  it('un ticket en curso o resuelto no cuenta como abierto', async () => {
    api({ OPEN: 0, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 4 });
    pintar();
    await screen.findByText('Ana García');

    const tarjeta = screen.getByText('Open tickets').closest('article')!;
    expect(await within(tarjeta).findByText('0')).toBeTruthy();
  });
});
