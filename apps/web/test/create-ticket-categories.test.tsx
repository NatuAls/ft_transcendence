import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreateTicketScreen } from '../src/features/tickets/CreateTicketScreen';
import { mockApi, reply } from './support/api';
import { ids } from './support/fixtures';

/**
 * Las categorías con las que se abre un ticket son las de la organización
 * activa.
 *
 * `WorkspacePage` las sacaba de `organizationFixture(organizationId)`, que
 * devuelve la MISMA lista de muestra para cualquier identificador que no
 * conozca — y los de verdad son UUID, así que no conocía ninguno. El
 * desplegable enseñaba «Northstar» y compañía en la aplicación real, y el
 * ticket se creaba con una categoría que no existe donde estás.
 */
const MUESTRA = ['Access', 'Billing', 'Hardware', 'Network'];

function categoria(id: string, name: string, isActive = true) {
  return {
    id,
    name,
    description: `Qué entra en ${name}`,
    color: '#0d6c90',
    isActive,
    _count: { tickets: 0 },
  };
}

function pintar() {
  return (
    <CreateTicketScreen
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      organizationId={ids.organization}
      organizationName="Ayuntamiento de Vilanova"
    />
  );
}

describe('categorías al crear un ticket', () => {
  it('ofrece las de la organización, no las de los datos de muestra', async () => {
    const { calls } = mockApi({
      [`GET /organizations/${ids.organization}/categories`]: reply(
        'GET /organizations/{organizationId}/categories',
        200,
        [
          categoria('01a1131b-d3f8-7399-b9a0-a98c2268205f', 'Padró'),
          categoria('01a1131b-d3f8-7399-b9a0-ae16a9393811', 'Llicències'),
        ],
      ),
    });

    render(pintar());

    expect(await screen.findByText('Padró')).toBeTruthy();
    expect(screen.getByText('Llicències')).toBeTruthy();
    for (const nombre of MUESTRA) {
      expect(screen.queryByText(nombre)).toBeNull();
    }
    expect(
      calls.some(
        (call) => call.path === `/organizations/${ids.organization}/categories`,
      ),
    ).toBe(true);
  });

  it('no ofrece una categoría desactivada: el ticket no podría encaminarse', async () => {
    mockApi({
      [`GET /organizations/${ids.organization}/categories`]: reply(
        'GET /organizations/{organizationId}/categories',
        200,
        [
          categoria('01a1131b-d3f8-7399-b9a0-a98c2268205f', 'Padró'),
          categoria('01a1131b-d3f8-7399-b9a0-ae16a9393811', 'Antiga', false),
        ],
      ),
    });

    render(pintar());

    expect(await screen.findByText('Padró')).toBeTruthy();
    expect(screen.queryByText('Antiga')).toBeNull();
  });
});
