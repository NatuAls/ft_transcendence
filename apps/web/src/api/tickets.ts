import {
  assignTicketSchema,
  createCommentSchema,
  searchTicketsQuerySchema,
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  type CreateTicketInput,
} from 'contracts';
import type { z } from 'zod';
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

export interface TicketListItemApi {
  id: string;
  reference: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  organizationId: string;
  categoryName: string | null;
  categoryId: string | null;
  categoryColor: string | null;
  authorUsername: string;
  authorDisplayName: string;
  assigneeUsername: string | null;
  assigneeDisplayName: string | null;
  commentCount: number;
  attachmentCount: number;
  rank: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface TicketsListApi {
  data: Array<TicketListItemApi>;
  meta: {
    total: number;
    page: number;
    take: number;
    pages: number;
    nextCursor: string | null;
    facets: Record<string, Record<string, number>>;
  };
}

export interface TicketData {
  id: string;
  title: string;
  status: string;
  priority: 'HIGH' | 'LOW' | 'MEDIUM';
  organizationId: string;
  categoryName?: string | null;
  categoryColor?: string | null;
  authorDisplayName: string;
  assigneeDisplayName?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type TicketsData = Array<TicketData>;

export interface TicketDetail {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: string;
  priority: 'HIGH' | 'LOW' | 'MEDIUM';
  organizationId: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryId: string | null;
  authorDisplayName: string;
  authorId: string;
  authorAvatarUrl: string | null;
  assigneeDisplayName?: string | null;
  assigneeId: string | null;
  assigneeAvatarUrl: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface TicketComment {
  author: {
    displayName: string;
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  body: string;
  createdAt: string;
  id: string;
  isInternal: boolean;
}

interface TicketCommentApi {
  author: {
    id: string;
    username: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
  body: string;
  createdAt: string;
  id: string;
  isInternal: boolean;
}

function toTicketComment(row: TicketCommentApi): TicketComment {
  return {
    author: {
      avatarUrl: row.author.profile?.avatarUrl ?? null,
      displayName: row.author.profile?.displayName || row.author.username,
      id: row.author.id,
      username: row.author.username,
    },
    body: row.body,
    createdAt: row.createdAt,
    id: row.id,
    isInternal: row.isInternal,
  };
}

export type SearchTicketsFilters = Omit<
  z.input<typeof searchTicketsQuerySchema>,
  'organizationId'
>;

/** TODO(BLOQUE): el tipo de entrada de tu esquema (CreateTicketInput, ...). */
export type TicketInput = CreateTicketInput;

// ---------------------------------------------------------------- rutas --

// TODO(BLOQUE): la ruta base de tu recurso, sin '/api/v1' (lo pone el cliente).
const RUTA = '/tickets';

// ------------------------------------------------------------ traducción --

/** Única frontera entre la forma de la API y la de la pantalla. */
export function toTicketData(row: TicketListItemApi): TicketData {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    organizationId: row.organizationId,
    categoryName: row.categoryName ?? '',
    categoryColor: row.categoryColor ?? '',
    authorDisplayName: row.authorDisplayName,
    assigneeDisplayName: row.assigneeDisplayName ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toTicketDetail(row: TicketDetailApi): TicketDetail {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    organizationId: row.organizationId,
    categoryName: row.category?.name ?? null,
    categoryId: row.category?.id ?? null,
    categoryColor: row.category?.color ?? null,
    authorDisplayName: row.createdBy.profile.displayName,
    authorId: row.createdBy.id,
    authorAvatarUrl: row.createdBy.profile.avatarUrl,
    assigneeDisplayName: row.assignedTo?.profile.displayName ?? null,
    assigneeId: row.assignedTo?.id ?? null,
    assigneeAvatarUrl: row.assignedTo?.profile.avatarUrl ?? null,
    resolution: row.resolution,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    commentCount: row._count.comments,
  };
}

// --------------------------------------------------------------- lecturas --

export async function searchTickets(
  organizationId: string,
  filters: SearchTicketsFilters,
  signal?: AbortSignal,
) {
  const parsed = searchTicketsQuerySchema.parse({ ...filters, organizationId });
  const urlQuery = {
    ...parsed,
    status: parsed.status?.join(','),
    priority: parsed.priority?.join(','),
  };
  const response = await request<TicketsListApi>(RUTA, {
    query: urlQuery,
    signal,
  });
  return {
    ...response,
    data: response.data.map(toTicketData),
  };
}

export async function getTicket(ticketId: string, signal?: AbortSignal) {
  const response = await request<TicketDetailApi>(`${RUTA}/${ticketId}`, {
    signal,
  });
  return toTicketDetail(response);
}

export async function listTicketComments(
  ticketId: string,
  signal?: AbortSignal,
): Promise<TicketComment[]> {
  return request<TicketCommentApi[]>(`${RUTA}/${ticketId}/comments`, {
    signal,
  }).then((rows) => rows.map(toTicketComment));
}

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

export async function updateTicket(
  ticketId: string,
  input: {
    categoryId?: string | null;
    priority?: 'HIGH' | 'LOW' | 'MEDIUM';
  },
): Promise<TicketDetail> {
  const response = await request<TicketDetailApi>(`${RUTA}/${ticketId}`, {
    method: 'PATCH',
    body: updateTicketSchema.parse(input),
  });
  return toTicketDetail(response);
}

export async function changeStatus(
  ticketId: string,
  input: {
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    resolution?: string | null;
    note?: string | null;
  },
): Promise<TicketDetail> {
  const body = {
    status: input.status,
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  const response = await request<TicketDetailApi>(
    `${RUTA}/${ticketId}/status`,
    {
      method: 'PATCH',
      body: changeStatusSchema.parse(body),
    },
  );
  return toTicketDetail(response);
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string | null,
): Promise<TicketDetail> {
  const response = await request<TicketDetailApi>(
    `${RUTA}/${ticketId}/assignee`,
    {
      method: 'PATCH',
      body: assignTicketSchema.parse({ assigneeId }),
    },
  );
  return toTicketDetail(response);
}

export async function createTicketComment(
  ticketId: string,
  body: string,
): Promise<TicketComment> {
  return request<TicketCommentApi>(`${RUTA}/${ticketId}/comments`, {
    method: 'POST',
    body: createCommentSchema.parse({ body }),
  }).then(toTicketComment);
}

/** 204 sin cuerpo: el cliente devuelve `undefined` y no intenta leer JSON. */
export async function deleteTicket(id: string): Promise<void> {
  await request(`${RUTA}/${id}`, { method: 'DELETE' });
}
