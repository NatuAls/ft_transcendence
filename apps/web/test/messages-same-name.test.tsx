import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Dos conversaciones con la misma persona… que no es la misma persona.
 *
 * El nombre de una conversación es `displayName ?? username` del otro, y dos
 * cuentas distintas pueden llamarse igual — pasó el 09/10 con tres «Felipe
 * Cela». La pantalla identificaba la conversación por ese nombre: para la
 * clave de la lista, para marcar la activa, para `setSelected` y para
 * descartar duplicados al abrir una nueva. Con dos homónimos:
 *
 *   · la lista fundía las dos en una,
 *   · al pulsar la segunda se resolvía la PRIMERA,
 *   · y el mensaje salía por `active.id`, o sea por la conversación de la
 *     otra persona.
 *
 * Esto último es lo que hay que impedir, y es lo que fija la última prueba.
 */
const ANA = {
  id: '01a11000-0000-7000-8000-00000000000a',
  username: 'felipe.gmail',
  profile: { displayName: 'Felipe Cela', avatarUrl: null, isOnline: true },
};
const BEA = {
  id: '01a11000-0000-7000-8000-00000000000b',
  username: 'felipe.duck',
  profile: { displayName: 'Felipe Cela', avatarUrl: null, isOnline: false },
};
const CONV_A = '01a11000-0000-7000-8000-0000000000c1';
const CONV_B = '01a11000-0000-7000-8000-0000000000c2';

const listConversations = vi.fn();
const listMessages = vi.fn(async () => ({ data: [], meta: { pages: 1 } }));
// Devuelve un mensaje bien formado: la pantalla añade la respuesta a la lista.
const sendMessage = vi.fn(async (conversationId: string, body: string) => ({
  id: '01a11000-0000-7000-8000-0000000000m1',
  body,
  conversationId,
  createdAt: '2026-10-09T10:05:00.000Z',
  editedAt: null,
  sender: {
    id: '01a11000-0000-7000-8000-00000000000f',
    username: 'yo',
    profile: { displayName: 'Yo', avatarUrl: null, isOnline: true },
  },
}));

vi.mock('../src/features/messages/messagesApi', () => ({
  listConversations: (...args: unknown[]) => listConversations(...args),
  listMessages: (...args: unknown[]) => listMessages(...args),
  markConversationRead: vi.fn(async () => ({})),
  openConversation: vi.fn(async () => ({ id: CONV_A })),
  searchUsers: vi.fn(async () => []),
  sendMessage: (conversationId: string, body: string) =>
    sendMessage(conversationId, body),
  socketOrigin: () => 'http://localhost',
  currentUserId: () => '01a11000-0000-7000-8000-00000000000f',
}));

// La sesión y el socket: esta prueba va de a quién se escribe, no de red.
vi.mock('../src/api/auth', () => ({ getAccessToken: () => 'token-de-prueba' }));
vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));

const { MessagesPage } = await import('../src/features/messages/MessagesPage');

function conversacion(id: string, participante: typeof ANA, ultimo: string) {
  return {
    id,
    participant: participante,
    lastMessage: { body: ultimo },
    lastMessageAt: '2026-10-09T10:00:00.000Z',
  };
}

function pintar() {
  render(<MessagesPage onOpenProfile={vi.fn()} onViewTickets={vi.fn()} />);
}

describe('dos conversaciones con el mismo nombre visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConversations.mockResolvedValue([
      conversacion(CONV_A, ANA, 'Mensaje de la primera cuenta'),
      conversacion(CONV_B, BEA, 'Mensaje de la segunda cuenta'),
    ]);
    listMessages.mockResolvedValue({ data: [], meta: { pages: 1 } });
  });

  it('las dos están en la lista: no se funden en una', async () => {
    pintar();
    await waitFor(() =>
      expect(screen.getAllByText('Felipe Cela').length).toBeGreaterThanOrEqual(
        2,
      ),
    );
    expect(screen.getByText('Mensaje de la primera cuenta')).toBeTruthy();
    expect(screen.getByText('Mensaje de la segunda cuenta')).toBeTruthy();
  });

  it('al abrir la SEGUNDA se piden sus mensajes, no los de la primera', async () => {
    pintar();
    await screen.findByText('Mensaje de la segunda cuenta');
    listMessages.mockClear();

    fireEvent.click(
      screen.getByText('Mensaje de la segunda cuenta').closest('button')!,
    );

    await waitFor(() => expect(listMessages).toHaveBeenCalled());
    expect(listMessages.mock.calls.some((call) => call[0] === CONV_B)).toBe(
      true,
    );
    expect(listMessages.mock.calls.some((call) => call[0] === CONV_A)).toBe(
      false,
    );
  });

  it('y el mensaje sale por la conversación de la segunda, no por la de la primera', async () => {
    pintar();
    await screen.findByText('Mensaje de la segunda cuenta');
    fireEvent.click(
      screen.getByText('Mensaje de la segunda cuenta').closest('button')!,
    );

    const caja = await screen.findByPlaceholderText(/message/i);
    fireEvent.change(caja, { target: { value: 'Hola' } });
    fireEvent.keyDown(caja, { key: 'Enter' });

    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(sendMessage.mock.calls[0]![0]).toBe(CONV_B);
  });
});
