import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SessionStatePage } from '../src/app/SessionStatePage';
import type { ViewerSession } from '../src/app/session';

/**
 * La pantalla a la que llega quien tiene cuenta pero todavía no pertenece a
 * ninguna organización — y quien está suspendido.
 *
 * La pertenencia NO es un campo de la persona: vive en la organización
 * (`OrganizationMember`), y para quien aún no tiene cuenta, en una reserva
 * por dirección (`OrganizationRoleGrant`). Por eso esta pantalla no ofrece
 * «crea tu organización» ni nada que dependa de la persona: lo único que la
 * resuelve es que un administrador añada su dirección.
 */
function viewerWith(overrides: Partial<ViewerSession> = {}): ViewerSession {
  return {
    accountState: 'ACTIVE',
    emailVerified: true,
    globalRole: 'USER',
    id: 'u1',
    memberships: [],
    pendingRoles: [],
    permissions: [],
    profile: { email: 'nuevo@example.com', fullName: 'Nuevo Usuario' },
    ...overrides,
  } as unknown as ViewerSession;
}

const props = {
  onPreviewIdentityChange: vi.fn(),
  onRecheck: vi.fn(async () => null),
  onSignOut: vi.fn(),
};

describe('pantalla de sesión sin organización', () => {
  it('dice qué pasa y a quién hay que pedírselo, con la dirección delante', () => {
    render(
      <SessionStatePage
        {...props}
        kind="no-organization"
        viewer={viewerWith()}
      />,
    );
    expect(screen.getByText('You are not in an organization yet')).toBeTruthy();
    // La dirección importa: es la clave por la que un administrador la añade.
    expect(document.body.textContent).toContain('nuevo@example.com');
    expect(
      document.body.textContent?.includes('organization administrator'),
    ).toBe(true);
  });

  it('lleva los enlaces legales, como el resto de pantallas', () => {
    render(
      <SessionStatePage
        {...props}
        kind="no-organization"
        viewer={viewerWith()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeTruthy();
  });

  it('se puede recomprobar sin cerrar sesión, y lo dice cuando sigue sin haber nada', async () => {
    const onRecheck = vi.fn(async () => null);
    render(
      <SessionStatePage
        {...props}
        kind="no-organization"
        onRecheck={onRecheck}
        viewer={viewerWith()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onRecheck).toHaveBeenCalled();
    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
  });

  it('a quien le espera un rol reservado le pide confirmar el correo, no una invitación', () => {
    render(
      <SessionStatePage
        {...props}
        kind="no-organization"
        viewer={viewerWith({
          emailVerified: false,
          pendingRoles: [
            {
              organizationName: 'Acme Support',
              role: 'AGENT',
            },
          ] as unknown as ViewerSession['pendingRoles'],
        })}
      />,
    );
    expect(screen.getByText('Confirm your e-mail to continue')).toBeTruthy();
  });

  it('la cuenta suspendida tiene su propio mensaje', () => {
    render(
      <SessionStatePage
        {...props}
        kind="suspended"
        viewer={viewerWith({ accountState: 'SUSPENDED' })}
      />,
    );
    expect(screen.getByText('Account suspended')).toBeTruthy();
  });
});
