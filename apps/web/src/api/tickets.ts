// ============================================================================
//  PLANTILLA · ADAPTADOR DE API                 (guía: apps/web/guia-bloques)
//
//  Destino al copiarlo:  src/api/<dominio>.ts   (p. ej. src/api/tickets.ts)
//  y cambia el import del cliente a '../core/api/client'.
//
//  Este fichero es el ÚNICO sitio de tu bloque que conoce rutas de la API.
//  Las pantallas importan estas funciones; nunca escriben '/tickets/...'.
//
//  Reglas:
//   1. Siempre `request()` / `upload()` del cliente compartido. Nada de
//      `fetch`, `axios` ni sockets propios: sin el cliente, un token caducado
//      no se renueva y el error llega sin forma.
//   2. Lo que se ENVÍA pasa por el esquema de `contracts` (`.parse`): el
//      navegador y el servidor validan con la MISMA regla.
//   3. Lo que se RECIBE se describe con una interfaz copiada del Swagger
//      (http://localhost:5000/api/v1/docs → la operación → «Responses»).
//      Si la pantalla necesita otra forma, se traduce aquí en UNA función
//      `toX()`, nunca dentro del componente.
//   4. Toda lectura acepta `signal`: `useAsync` la cancela al desmontar o al
//      cambiar de filtros, y así no se pinta una respuesta vieja.
//
//  Cada `TODO(BLOQUE)` es un hueco que tienes que rellenar. Cuando no quede
//  ninguno (`grep -rn "TODO(BLOQUE)" src/`), el adaptador está terminado.
// ============================================================================
import {
  // TODO(BLOQUE): tus esquemas de packages/contracts. Aquí se usan los de
  // organización sólo para que la plantilla compile (nombre + descripción).
  createTicketSchema,
  type CreateTicketInput,
} from 'contracts';
import { request } from '../core/api/client';

// ---------------------------------------------------------------- tipos --

/**
 * Lo que devuelve la API, campo a campo, tal cual sale en el Swagger.
 * TODO(BLOQUE): copia aquí el esquema de respuesta de tu endpoint.
 */
export interface TicketDetailApi {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  organizationId: string;
  category: {
    id: string;
    name: string;
    color: string;
    description: string;
    isActive: boolean;
    _count: {
      tickets: number;
    };
  } | null;
  createdBy: {
    id: string;
    username: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    };
  };
  assignedTo: {
    id: string;
    username: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    };
  } | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  _count: {
    comments: number;
    attachments: number;
  };
}

export interface NewTicketValues {
  organizationId: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'LOW' | 'MEDIUM';
  categoryId?: string | undefined;
}

/** TODO(BLOQUE): el tipo de entrada de tu esquema (CreateTicketInput, ...). */
export type TicketInput = CreateTicketInput;

// ---------------------------------------------------------------- rutas --

// TODO(BLOQUE): la ruta base de tu recurso, sin '/api/v1' (lo pone el cliente).
const RUTA = '/tickets';

// ------------------------------------------------------------- escrituras --

/**
 * Crear. El esquema compartido valida y limpia (trim, valores por defecto)
 * ANTES de enviar: si el formulario ya lo validó, aquí no fallará; si alguien
 * llama a esta función sin pasar por el formulario, tampoco sale basura.
 */
export async function createTicket(
  input: NewTicketValues,
): Promise<TicketDetailApi> {
  const created = await request<TicketDetailApi>(RUTA, {
    method: 'POST',
    body: { ...createTicketSchema.parse(input) },
  });
  return created;
}

/** 204 sin cuerpo: el cliente devuelve `undefined` y no intenta leer JSON. */
export async function deleteTicket(id: string): Promise<void> {
  await request(`${RUTA}/${id}`, { method: 'DELETE' });
}

// ------------------------------------------------------ hijos del recurso --

/**interface ElementoApi {
  author: { displayName: string | null; username: string };
  body: string;
  createdAt: string;
  id: string;
}

function toElemento(row: ElementoApi): Elemento {
  return {
    autor: row.author.displayName || row.author.username,
    creado: row.createdAt,
    id: row.id,
    texto: row.body,
  };
}*/

/** TODO(BLOQUE): p. ej. GET /tickets/:id/comments o /conversations/:id/messages. */
/**export async function listElementos(
  recursoId: string,
  signal?: AbortSignal,
): Promise<Elemento[]> {
  const rows = await request<ElementoApi[]>(`${RUTA}/${recursoId}/TODO-hijos`, {
    signal,
  });
  return rows.map(toElemento);
}

export async function createElemento(
  recursoId: string,
  texto: string,
): Promise<Elemento> {
  const created = await request<ElementoApi>(
    `${RUTA}/${recursoId}/TODO-hijos`,
    // TODO(BLOQUE): valida con tu esquema (createCommentSchema, sendMessageSchema).
    { method: 'POST', body: { body: texto } },
  );
  return toElemento(created);
}*/

/**
 * Traduce el payload de un evento en tiempo real. Los eventos no siempre
 * traen la misma forma que el REST: mira qué envía `event-bridge.ts` en la
 * API. Devuelve `null` si el evento no es de este recurso.
 */
/**export function elementoDeEvento(
  payload: unknown,
  recursoId: string,
): Elemento | null {
  // TODO(BLOQUE): ajusta a la forma real (p. ej. { comment, ticket }).
  const evento = payload as { item?: ElementoApi; parentId?: string };
  if (!evento.item || evento.parentId !== recursoId) return null;
  return toElemento(evento.item);
}*/

// ---------------------------------------------------------------- ficheros --

/**
 * Subida con barra de progreso (adjuntos). `upload()` usa XHR porque `fetch`
 * no informa del progreso, y renueva la sesión igual que `request()`.
 * El campo SIEMPRE se llama `file`.
 *
 * El avatar es la excepción: va por PUT y sin progreso (ver api/users.ts).
 */
/**export function uploadAdjunto(
  recursoId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  // TODO(BLOQUE): p. ej. `/tickets/${recursoId}/attachments`.
  return upload(`${RUTA}/${recursoId}/TODO-adjuntos`, form, onProgress);
}*/
