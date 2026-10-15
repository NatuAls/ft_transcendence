import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { AppErrorBoundary } from '../src/app/AppErrorBoundary';
import type { AppSection } from '../src/app/routes';
import { SessionStatePage } from '../src/app/SessionStatePage';
import type { Permission, ViewerSession } from '../src/app/session';
import { AppFooter } from '../src/layout/AppFooter';
import { AppShell } from '../src/layout/AppShell';
import { viewerSession } from './support/fixtures';

/**
 * El armazón —menú lateral, barra y título del móvil, menú de la cuenta, pie—
 * y las pantallas que van fuera de él cambian de idioma con todo lo demás.
 * Cambiar el idioma y seguir viendo el menú en inglés era lo primero que se
 * notaba; y en el móvil, la barra y el título enseñaban la clave en crudo.
 */
const PLATAFORMA: Permission[] = [
  'organization:update',
  'member:read',
  'user:listAll',
  'audit:read',
];

const idioma = (lengua: 'ca' | 'en' | 'es') =>
  act(async () => {
    await i18next.changeLanguage(lengua);
  });

function armazon(
  seccion: AppSection,
  viewer: ViewerSession = viewerSession({
    globalRole: 'GLOBAL_ADMIN',
    permissions: PLATAFORMA,
  }),
) {
  render(
    <AppShell
      activeOrganizationId="org-1"
      activeRoute="tickets"
      activeSection={seccion}
      onNavigate={vi.fn()}
      onOrganizationChange={vi.fn()}
      onPreviewIdentityChange={vi.fn()}
      onSignOut={vi.fn()}
      organizationName="Vilanova"
      organizationOptions={[{ id: 'org-1', name: 'Vilanova' }]}
      userEmail="ana@example.com"
      userName="Ana García"
      viewer={viewer}
    >
      <p>Contenido</p>
    </AppShell>,
  );
}

/** Ninguna clave a la vista: ni en el texto ni en lo que oye un lector. */
function sinClaves() {
  expect(document.body.textContent).not.toMatch(
    /\b(nav|common|session|search|account|auth)\.[a-zA-Z]/,
  );
  const etiquetas = [...document.querySelectorAll('[aria-label]')].map(
    (elemento) => elemento.getAttribute('aria-label') ?? '',
  );
  expect(
    etiquetas.filter((etiqueta) => /^[a-z]+\.[a-zA-Z.]+$/.test(etiqueta)),
  ).toEqual([]);
}

const textos = (elementos: HTMLElement[]) =>
  elementos.map((elemento) => elemento.textContent?.trim());

afterEach(async () => {
  await idioma('en');
});

describe('el armazón, en el idioma de quien mira', () => {
  it('menú lateral, barra del móvil y su título, en castellano', async () => {
    await idioma('es');
    armazon('admin/audit');

    const lateral = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    for (const entrada of [
      'ORGANIZACIÓN',
      'Personas',
      'Roles y acceso',
      'PLATAFORMA',
      'Usuarios',
      'Roles de plataforma',
      'Registro de auditoría',
    ])
      expect(within(lateral).getByText(entrada)).toBeTruthy();

    const movil = screen.getByRole('navigation', { name: 'Navegación móvil' });
    expect(textos(within(movil).getAllByRole('button'))).toEqual([
      'Tickets',
      'Personas',
      'Mensajes',
      'Cuenta',
    ]);
    // El título del móvil es el de la sección abierta, no su clave.
    const cabecera = screen.getByRole('button', {
      name: 'Ir a tickets',
    }).parentElement!;
    expect(within(cabecera).getByText('Registro de auditoría')).toBeTruthy();
    sinClaves();
  });

  it('el menú de la cuenta, en catalán, y cambia de idioma abierto', async () => {
    await idioma('ca');
    armazon('tickets');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Obre el menú del compte' })[0]!,
    );
    const menu = screen.getByRole('menu', { name: 'Menú del compte' });
    expect(textos(within(menu).getAllByRole('menuitem'))).toEqual([
      'Configuració del perfil',
      'Preferències',
      'Privacitat i dades',
      'Organitzacions',
      'Rols i accés',
      'Usuaris de la plataforma',
      'Rols de plataforma',
      'Registre d’auditoria',
      'Tanca la sessió',
    ]);
    sinClaves();

    await idioma('en');
    expect(textos(within(menu).getAllByRole('menuitem'))).toEqual([
      'Profile settings',
      'Preferences',
      'Privacy & data',
      'Organizations',
      'Roles & access',
      'Platform users',
      'Platform roles',
      'Audit log',
      'Sign out',
    ]);
  });

  it('quien no administra la plataforma ve «sus» organizaciones y nada más', async () => {
    await idioma('es');
    armazon('tickets', viewerSession());
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Abrir menú de cuenta' })[0]!,
    );
    expect(
      textos(
        within(
          screen.getByRole('menu', { name: 'Menú de cuenta' }),
        ).getAllByRole('menuitem'),
      ),
    ).toEqual([
      'Configuración del perfil',
      'Preferencias',
      'Privacidad y datos',
      'Tus organizaciones',
      'Roles y acceso',
      'Cerrar sesión',
    ]);
    expect(screen.queryByText('PLATAFORMA')).toBeNull();
  });

  it('el pie, en catalán', async () => {
    await idioma('ca');
    render(<AppFooter from="tickets" />);
    expect(
      screen.getByText('HelpDesk Lite · un projecte acadèmic de 42 Barcelona'),
    ).toBeTruthy();
    const legal = screen.getByRole('navigation', {
      name: 'Informació legal i del servei',
    });
    expect(textos(within(legal).getAllByRole('link'))).toEqual([
      'Política de privacitat',
      'Termes del servei',
      'Estat del servei',
    ]);
  });
});

describe('fuera del armazón', () => {
  it('quien aún no tiene organización lo lee en castellano, con su dirección', async () => {
    await idioma('es');
    render(
      <SessionStatePage
        kind="no-organization"
        onPreviewIdentityChange={vi.fn()}
        onRecheck={vi.fn(async () => null)}
        onSignOut={vi.fn()}
        viewer={viewerSession()}
      />,
    );
    expect(
      screen.getByRole('heading', {
        name: 'Todavía no estás en ninguna organización',
      }),
    ).toBeTruthy();
    expect(document.body.textContent).toContain(
      'que dé un rol a tu dirección, ana@example.com;',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar de nuevo' }));
    expect(await screen.findByText(/^Todavía nada:/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Política de privacidad' }),
    ).toBeTruthy();
    sinClaves();
  });

  it('quien está suspendido, en catalán', async () => {
    await idioma('ca');
    render(
      <SessionStatePage
        kind="suspended"
        onPreviewIdentityChange={vi.fn()}
        onRecheck={vi.fn(async () => null)}
        onSignOut={vi.fn()}
        viewer={viewerSession({ accountState: 'SUSPENDED' })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Compte suspès' })).toBeTruthy();
    sinClaves();
  });

  it('un fallo inesperado se explica en el idioma de quien mira', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Revienta(): never {
      throw new Error('fallo de prueba');
    }
    await idioma('ca');
    render(
      <AppErrorBoundary>
        <Revienta />
      </AppErrorBoundary>,
    );
    const aviso = screen.getByRole('alert');
    expect(within(aviso).getByText('Alguna cosa ha fallat')).toBeTruthy();
    expect(
      within(aviso).getByRole('button', { name: 'Tornar als tiquets' }),
    ).toBeTruthy();
    consola.mockRestore();
  });
});
