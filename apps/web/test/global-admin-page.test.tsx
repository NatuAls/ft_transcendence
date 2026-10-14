import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { GlobalAdminPage } from '../src/features/admin/GlobalAdminPage';
import type { OrganizationSummary } from '../src/features/organizations/organizationsData';
import { mockApi, reply } from './support/api';
import { adminUser, ids, page, platformReservation } from './support/fixtures';

/**
 * Usuarios de la plataforma. Hasta el 13/10 no tenía ni un test, y es la
 * pantalla que más daño puede hacer: suspende, cambia el rol de plataforma y
 * borra cuentas. Además, rol y estado eran el texto en inglés de la fila
 * —«Global admin», «Active»— y filtros y guardado comparaban contra él: al
 * traducirlos pasaron a ser códigos, y esto comprueba que lo que sale hacia la
 * API sigue siendo exactamente lo mismo, en cualquier idioma.
 */
/** Closed by an administrator on 1 October: its data goes on the 31st. */
const CERRADA = '01a106fe-4f60-7b55-9d84-ae9170f6e544';
const cerrada = adminUser({
  id: CERRADA,
  username: 'oldie',
  email: 'oldie@example.com',
  globalRole: 'USER',
  isActive: false,
  deletedAt: '2026-10-01T10:00:00.000Z',
  erasureDueAt: '2026-10-31T10:00:00.000Z',
  profile: { displayName: 'Old Account', avatarUrl: null, isOnline: false },
});

const accounts = [
  adminUser(),
  adminUser({
    id: ids.primary,
    username: 'recovery',
    email: 'recovery@helpdesk.example',
    isPrimary: true,
    profile: { displayName: 'Recovery', avatarUrl: null, isOnline: false },
  }),
  adminUser({
    id: ids.agent,
    username: 'maya',
    email: 'maya@example.com',
    globalRole: 'USER',
    _count: { memberships: 2, ticketsCreated: 0 },
    profile: { displayName: 'Maya Singh', avatarUrl: null, isOnline: false },
  }),
  adminUser({
    id: ids.member,
    username: 'john',
    email: 'john@example.com',
    globalRole: 'USER',
    isActive: false,
    profile: { displayName: 'John Lee', avatarUrl: null, isOnline: false },
  }),
];

const organizations: OrganizationSummary[] = [
  {
    counts: { members: 3, tickets: 5 },
    description: '',
    id: ids.organization,
    initials: 'AS',
    name: 'Acme Support',
    role: null,
    slug: 'acme-support',
  },
];

function api(extra: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    'GET /users': reply('GET /users', 200, page(accounts)),
    'GET /admin/role-grants': reply('GET /admin/role-grants', 200, [
      platformReservation(),
    ]),
    'GET /admin/stats': reply('GET /admin/stats', 200, {
      users: 240,
      activeUsers: 231,
      organizations: 12,
      tickets: 1830,
      openTickets: 97,
      messages: 5120,
      attachments: 310,
    }),
    ...extra,
  });
}

function pintar() {
  return render(
    <GlobalAdminPage currentUserId={ids.admin} organizations={organizations} />,
  );
}

/** La fila de una cuenta: su botón, que lleva el nombre. */
const fila = (name: string, editar = 'Edit') =>
  screen.getByRole('button', { name: `${editar} ${name}` });

afterEach(async () => {
  await i18next.changeLanguage('en');
});

function conCerrada(extra: Parameters<typeof mockApi>[0] = {}) {
  return api({
    'GET /users': reply('GET /users', 200, page([...accounts, cerrada])),
    ...extra,
  });
}

describe('usuarios de la plataforma', () => {
  it('pinta cuentas e invitaciones con su rol y su estado', async () => {
    api();
    pintar();
    await screen.findByText('Maya Singh');
    expect(
      within(fila('Maya Singh')).getByText('2 organizations'),
    ).toBeTruthy();
    expect(within(fila('Ana García')).getByText('1 organization')).toBeTruthy();
    expect(within(fila('Maya Singh')).getByText('Standard user')).toBeTruthy();
    expect(within(fila('Ana García')).getByText('Global admin')).toBeTruthy();
    expect(within(fila('John Lee')).getByText(/Suspended/)).toBeTruthy();
    // La invitación pendiente se ve, pero no se edita: aún no hay cuenta.
    const invitacion = fila('new.admin@example.com') as HTMLButtonElement;
    expect(within(invitacion).getByText(/Invitation pending/)).toBeTruthy();
    expect(invitacion.disabled).toBe(true);
    expect(
      screen.getByText('Showing 5 of 5 accounts and invitations'),
    ).toBeTruthy();
  });

  it('filtra por rol y por estado con los códigos, no con el texto', async () => {
    api();
    pintar();
    await screen.findByText('Maya Singh');

    fireEvent.change(screen.getByLabelText('Roles'), {
      target: { value: 'USER' },
    });
    expect(screen.getByText('Maya Singh')).toBeTruthy();
    expect(screen.getByText('John Lee')).toBeTruthy();
    expect(screen.queryByText('Ana García')).toBeNull();

    fireEvent.change(screen.getByLabelText('States'), {
      target: { value: 'SUSPENDED' },
    });
    expect(screen.getByText('John Lee')).toBeTruthy();
    expect(screen.queryByText('Maya Singh')).toBeNull();
    expect(
      screen.getByText('Showing 1 of 5 accounts and invitations'),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Roles'), {
      target: { value: 'all' },
    });
    fireEvent.change(screen.getByLabelText('States'), {
      target: { value: 'PENDING' },
    });
    // Una invitación aún no tiene nombre: su dirección sale dos veces.
    expect(fila('new.admin@example.com')).toBeTruthy();
    expect(screen.queryByText('John Lee')).toBeNull();
  });

  it('cambiar rol y estado manda a la API lo mismo que antes, y sólo lo que cambia', async () => {
    const { calls } = api({
      [`PATCH /users/${ids.agent}/role`]: reply(
        'PATCH /users/{user}/role',
        200,
        {
          id: ids.agent,
          username: 'maya',
          globalRole: 'GLOBAL_ADMIN',
        },
      ),
      [`PATCH /users/${ids.agent}/status`]: reply(
        'PATCH /users/{user}/status',
        200,
        { id: ids.agent, username: 'maya', isActive: false },
      ),
    });
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Maya Singh' }),
    );
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Platform access'), {
      target: { value: 'GLOBAL_ADMIN' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Account state'), {
      target: { value: 'SUSPENDED' },
    });
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Save changes' }),
    );

    expect(await screen.findByText('Maya Singh was updated.')).toBeTruthy();
    const escrituras = calls.filter((call) => call.method !== 'GET');
    expect(escrituras.map((call) => `${call.method} ${call.path}`)).toEqual([
      `PATCH /users/${ids.agent}/role`,
      `PATCH /users/${ids.agent}/status`,
    ]);
    expect(escrituras[0]!.body).toEqual({ globalRole: 'GLOBAL_ADMIN' });
    expect(escrituras[1]!.body).toEqual({ isActive: false });
  });

  it('tu propia cuenta: ni rol, ni estado, ni borrar, y dice por qué', async () => {
    api();
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Ana García' }),
    );
    const dialogo = await screen.findByRole('dialog');
    expect(
      (within(dialogo).getByLabelText('Platform access') as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      (within(dialogo).getByLabelText('Account state') as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      within(dialogo).queryByRole('button', { name: 'Delete' }),
    ).toBeNull();
    expect(
      within(dialogo).getByText(
        'This is your own account: another administrator has to change your role or state.',
      ),
    ).toBeTruthy();
  });

  it('el administrador principal tampoco se toca', async () => {
    api();
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Recovery' }),
    );
    const dialogo = await screen.findByRole('dialog');
    expect(
      (within(dialogo).getByLabelText('Platform access') as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      within(dialogo).queryByRole('button', { name: 'Delete' }),
    ).toBeNull();
    expect(within(dialogo).getByText(/primary administrator/)).toBeTruthy();
  });

  it('borrar una cuenta pide confirmación, anuncia la fecha del borrado y llama a la API una vez', async () => {
    const { calls } = api({
      [`DELETE /users/${ids.member}`]: reply('DELETE /users/{user}', 204),
    });
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit John Lee' }),
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    const confirmacion = await screen.findByRole('dialog');
    expect(within(confirmacion).getByText('Delete John Lee?')).toBeTruthy();
    // Dentro de 30 días, como la API: la fecha sale del contrato compartido.
    const dentroDe30 = new Intl.DateTimeFormat('en', {
      dateStyle: 'long',
    }).format(new Date(Date.now() + 30 * 86_400_000));
    expect(
      within(confirmacion).getByText(
        new RegExp(
          `erased for good on ${dentroDe30}; until then you can restore`,
        ),
      ),
    ).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    fireEvent.click(
      within(confirmacion).getByRole('button', { name: 'Delete account' }),
    );
    expect(
      await screen.findByText(
        `John Lee's account was closed. Its personal data will be erased on ${dentroDe30}; until then you can restore it.`,
      ),
    ).toBeTruthy();
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1);
  });

  it('invitar a un usuario estándar reserva el rol elegido en la organización', async () => {
    const { calls } = api({
      [`POST /organizations/${ids.organization}/role-grants`]: reply(
        'POST /organizations/{organizationId}/role-grants',
        201,
        {
          outcome: 'RESERVED',
          email: 'nueva@example.com',
          role: 'AGENT',
          user: null,
          reservation: {
            id: ids.reservation,
            organizationId: ids.organization,
            email: 'nueva@example.com',
            role: 'AGENT',
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
    pintar();
    await screen.findByText('Maya Singh');
    fireEvent.click(screen.getByRole('button', { name: 'Invite user' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Email address'), {
      target: { value: 'nueva@example.com' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Organization role'), {
      target: { value: 'AGENT' },
    });
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Send invitation' }),
    );

    expect(
      await screen.findByText(/Invitation sent to nueva@example\.com/),
    ).toBeTruthy();
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.body).toEqual({ email: 'nueva@example.com', role: 'AGENT' });
  });

  it('una cuenta cerrada se ve como tal, con la fecha en que se borran sus datos', async () => {
    const { calls } = conCerrada();
    pintar();
    const fila = await screen.findByRole('button', {
      name: 'Edit Old Account',
    });
    expect(within(fila).getByText(/Closed/)).toBeTruthy();
    expect(
      within(fila).getByText('Data erased on October 31, 2026'),
    ).toBeTruthy();
    // La pantalla la pide a la API: sin ella no saldría.
    expect(
      calls.find((call) => call.path === '/users')!.query.get('includeClosed'),
    ).toBe('true');
    // No cuenta como cuenta en uso.
    fireEvent.change(screen.getByLabelText('States'), {
      target: { value: 'CLOSED' },
    });
    expect(
      screen.getByText('Showing 1 of 6 accounts and invitations'),
    ).toBeTruthy();
  });

  it('restaurar una cuenta cerrada', async () => {
    const { calls } = conCerrada({
      [`POST /users/${CERRADA}/restore`]: reply(
        'POST /users/{user}/restore',
        200,
        { id: CERRADA, username: 'oldie', isActive: true },
      ),
    });
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Old Account' }),
    );
    const dialogo = await screen.findByRole('dialog');
    expect(
      within(dialogo).getByText(/erased for good on October 31, 2026/),
    ).toBeTruthy();
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Restore account' }),
    );
    expect(
      await screen.findByText("Old Account's account was restored."),
    ).toBeTruthy();
    expect(
      calls.filter((call) => call.method === 'POST').map((call) => call.path),
    ).toEqual([`/users/${CERRADA}/restore`]);
  });

  it('borrar ya los datos pide confirmar, porque no se puede deshacer', async () => {
    const { calls } = conCerrada({
      [`POST /users/${CERRADA}/erase`]: reply('POST /users/{user}/erase', 204),
    });
    pintar();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit Old Account' }),
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Erase data now',
      }),
    );
    let dialogo = await screen.findByRole('dialog');
    expect(
      within(dialogo).getByText("Erase Old Account's data now?"),
    ).toBeTruthy();
    // Pensárselo: vuelve sin llamar a nadie.
    fireEvent.click(
      within(dialogo).getByRole('button', {
        name: 'Wait until October 31, 2026',
      }),
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Erase data now',
      }),
    );
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Erase now' }));
    expect(
      await screen.findByText("Old Account's personal data was erased."),
    ).toBeTruthy();
    expect(
      calls.filter((call) => call.method === 'POST').map((call) => call.path),
    ).toEqual([`/users/${CERRADA}/erase`]);
  });

  it('en castellano, la tabla y los filtros hablan castellano', async () => {
    await i18next.changeLanguage('es');
    api();
    pintar();
    await screen.findByText('Maya Singh');
    expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeTruthy();
    const maya = fila('Maya Singh', 'Editar a');
    expect(within(maya).getByText('Usuario estándar')).toBeTruthy();
    expect(within(maya).getByText('2 organizaciones')).toBeTruthy();
    expect(
      within(fila('John Lee', 'Editar a')).getByText(/Suspendida/),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Invitación pendiente' }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /\b(admin|organization|common)\.[a-z]/,
    );
  });
});
