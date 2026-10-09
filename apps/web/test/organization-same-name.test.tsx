import { describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { OrganizationPage } from '../src/features/organization/OrganizationPage';
import { mockApi, reply } from './support/api';
import { ids, member } from './support/fixtures';

/**
 * Tres cuentas distintas con el mismo nombre visible.
 *
 * Pasó el 09/10 en el entorno local: tres direcciones de la misma persona
 * —@gmail, @hotmail y @duck— con el nombre «Felipe Cela» en las tres. La
 * pantalla usaba ese NOMBRE como identidad de la fila, y eso rompía dos cosas
 * a la vez:
 *
 *   · la clave de React se repetía, y al recargarse la lista aparecían filas
 *     repetidas o fantasma —incluso bajo otra pestaña—,
 *   · los identificadores se guardaban en diccionarios con el nombre como
 *     clave, así que de tres «Felipe Cela» sólo sobrevivía el último: abrir
 *     la primera fila y guardar cambiaba el rol de la TERCERA cuenta.
 *
 * Lo segundo es lo grave, y es lo que fija la última prueba.
 */
const base = `/organizations/${ids.organization}`;
const GMAIL = '01a1137b-dae3-70b9-8000-000000000001';
const HOTMAIL = '01a1137b-dae3-70b9-8000-000000000002';
const DUCK = '01a1137b-dae3-70b9-8000-000000000003';

function api() {
  return mockApi({
    [`GET ${base}`]: reply('GET /organizations/{organizationId}', 200, {
      id: ids.organization,
      name: 'Vilanova',
      slug: 'vilanova',
      description: null,
      createdById: ids.admin,
      myRole: 'ORG_ADMIN',
      createdAt: '2026-10-01T09:00:00.000Z',
      _count: { members: 3, tickets: 0, categories: 0 },
    }),
    [`GET ${base}/members`]: reply(
      'GET /organizations/{organizationId}/members',
      200,
      [
        member({
          id: GMAIL,
          role: 'AGENT',
          username: 'fc-gmail',
          email: 'felipecela@gmail.com',
          displayName: 'Felipe Cela',
        }),
        member({
          id: HOTMAIL,
          role: 'AGENT',
          username: 'fc-hotmail',
          email: 'felipecela@hotmail.com',
          displayName: 'Felipe Cela',
        }),
        member({
          id: DUCK,
          role: 'MEMBER',
          username: 'fc-duck',
          email: 'felipecela@duck.com',
          displayName: 'Felipe Cela',
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
    [`PATCH ${base}/members/${GMAIL}`]: reply(
      'PATCH /organizations/{organizationId}/members/{userId}',
      200,
      {
        id: ids.reservation,
        role: 'MEMBER',
        organizationId: ids.organization,
        user: { id: GMAIL, username: 'fc-gmail' },
      },
    ),
  });
}

function pintar() {
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
      organizationName="Vilanova"
      organizationRole="ORG_ADMIN"
    />,
  );
}

describe('tres cuentas con el mismo nombre visible', () => {
  it('pinta las tres filas, una por cuenta', async () => {
    api();
    pintar();
    expect(await screen.findByText('felipecela@gmail.com')).toBeTruthy();
    expect(screen.getByText('felipecela@hotmail.com')).toBeTruthy();
    expect(screen.getByText('felipecela@duck.com')).toBeTruthy();
    expect(screen.getAllByText('Felipe Cela')).toHaveLength(3);
  });

  it('cada fila tiene su propio botón de editar: no se colapsan', async () => {
    api();
    pintar();
    await screen.findByText('felipecela@gmail.com');
    expect(
      screen.getAllByRole('button', { name: 'Edit Felipe Cela' }),
    ).toHaveLength(3);
  });

  it('editar la PRIMERA fila actúa sobre la primera cuenta, no sobre la última', async () => {
    const { calls } = api();
    pintar();
    await screen.findByText('felipecela@gmail.com');

    // La primera fila es la de @gmail. Antes, el identificador salía de un
    // diccionario con el nombre como clave, así que esto editaba a @duck.
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Edit Felipe Cela' })[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(
      within(dialog).getByRole('combobox', { name: 'Organization role' }),
      { target: { value: 'Member' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save access' }),
    );

    await waitFor(() =>
      expect(calls.some((call) => call.method === 'PATCH')).toBe(true),
    );
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch!.path).toBe(
      `/organizations/${ids.organization}/members/${GMAIL}`,
    );
    expect(patch!.path).not.toContain(DUCK);
  });
});
