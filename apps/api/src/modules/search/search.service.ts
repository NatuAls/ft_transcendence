import { Prisma } from '../../generated/prisma/client.ts';
import type { SearchTicketsQuery } from 'contracts';
import { prisma } from '../../database/prisma.ts';
import { paginate, type Paginated } from '../../common/utils/pagination.ts';
import type { RequestActor } from '../../common/types.ts';

interface FacetRow {
  status: string;
  priority: string;
  count: bigint;
}

export interface TicketSearchResult {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  categoryName: string | null;
  categoryColor: string | null;
  authorUsername: string;
  authorDisplayName: string;
  assigneeUsername: string | null;
  assigneeDisplayName: string | null;
  commentCount: number;
  attachmentCount: number;
  rank: number | null;
}

/**
 * Advanced ticket search.
 *
 * Full-text search uses PostgreSQL `to_tsvector` with the accent-insensitive
 * `helpdesk_es` configuration and a GIN index, NOT `LIKE '%text%'`. Every
 * fragment is parameterised through Prisma.sql; no user input is ever
 * concatenated into SQL.
 */
export async function searchTickets(
  actor: RequestActor,
  allowedOrganizationIds: string[],
  query: SearchTicketsQuery,
): Promise<Paginated<TicketSearchResult> & { meta: { facets?: unknown } }> {
  const started = Date.now();
  const where: Prisma.Sql[] = [];

  // Multi-tenant isolation lives here, not in the caller. A GLOBAL_ADMIN with
  // no organization filter is the only case that sees across tenants.
  if (query.organizationId) {
    where.push(Prisma.sql`t."organizationId" = ${query.organizationId}::uuid`);
  } else if (actor.globalRole !== 'GLOBAL_ADMIN') {
    if (allowedOrganizationIds.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: 1, take: query.take, pages: 1, tookMs: 0 },
      };
    }
    where.push(
      Prisma.sql`t."organizationId" IN (${Prisma.join(allowedOrganizationIds.map((id) => Prisma.sql`${id}::uuid`))})`,
    );
  }

  if (query.status?.length) {
    where.push(
      Prisma.sql`t."status"::text IN (${Prisma.join(query.status.map((s) => Prisma.sql`${s}`))})`,
    );
  }
  if (query.priority?.length) {
    where.push(
      Prisma.sql`t."priority"::text IN (${Prisma.join(query.priority.map((p) => Prisma.sql`${p}`))})`,
    );
  }
  if (query.categoryId)
    where.push(Prisma.sql`t."categoryId" = ${query.categoryId}::uuid`);

  if (query.assignedToId === 'unassigned') {
    where.push(Prisma.sql`t."assignedToId" IS NULL`);
  } else if (query.assignedToId) {
    const id = query.assignedToId === 'me' ? actor.id : query.assignedToId;
    where.push(Prisma.sql`t."assignedToId" = ${id}::uuid`);
  }

  if (query.createdById) {
    const id = query.createdById === 'me' ? actor.id : query.createdById;
    where.push(Prisma.sql`t."createdById" = ${id}::uuid`);
  }

  if (query.hasAttachments !== undefined) {
    where.push(
      query.hasAttachments
        ? Prisma.sql`EXISTS (SELECT 1 FROM attachments a WHERE a."ticketId" = t.id AND a."deletedAt" IS NULL)`
        : Prisma.sql`NOT EXISTS (SELECT 1 FROM attachments a WHERE a."ticketId" = t.id AND a."deletedAt" IS NULL)`,
    );
  }

  if (query.createdFrom)
    where.push(Prisma.sql`t."createdAt" >= ${new Date(query.createdFrom)}`);
  if (query.createdTo)
    where.push(Prisma.sql`t."createdAt" <= ${new Date(query.createdTo)}`);
  if (query.updatedFrom)
    where.push(Prisma.sql`t."updatedAt" >= ${new Date(query.updatedFrom)}`);
  if (query.updatedTo)
    where.push(Prisma.sql`t."updatedAt" <= ${new Date(query.updatedTo)}`);

  const hasText = Boolean(query.q && query.q.trim().length >= 2);
  // helpdesk_unaccent() is our IMMUTABLE wrapper around unaccent(), created in
  // apps/api/prisma/manual/01-constraints-and-search-index.sql. The expression
  // below has to be IDENTICAL to the one the GIN index was built on -
  // character for character - or PostgreSQL falls back to a Seq Scan.
  const tsQuery = hasText
    ? Prisma.sql`websearch_to_tsquery('helpdesk_es', helpdesk_unaccent(${query.q!.trim()}))`
    : null;
  if (tsQuery) {
    where.push(
      Prisma.sql`(
        to_tsvector('helpdesk_es', helpdesk_unaccent(coalesce(t.title,'') || ' ' || coalesce(t.description,'') || ' ' || t.reference))
        @@ ${tsQuery}
      )`,
    );
  }

  const whereSql = where.length
    ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}`
    : Prisma.empty;

  // Sorting: whitelist only, never interpolate the raw sort parameter.
  const sortColumn =
    {
      createdAt: 't."createdAt"',
      updatedAt: 't."updatedAt"',
      title: 't.title',
      reference: 't.reference',
      status: 't."status"',
      priority: `CASE t."priority" WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END`,
    }[query.sort] ?? 't."createdAt"';
  const direction = query.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const orderSql = hasText
    ? Prisma.sql`ORDER BY rank DESC, ${Prisma.raw(sortColumn)} ${direction}`
    : Prisma.sql`ORDER BY ${Prisma.raw(sortColumn)} ${direction}, t.id DESC`;

  const offset = (query.page - 1) * query.take;

  const rows = await prisma.$queryRaw<TicketSearchResult[]>(Prisma.sql`
    SELECT t.id, t.reference, t.title, t."status"::text AS status, t."priority"::text AS priority,
           t."createdAt", t."updatedAt", t."organizationId",
           c.name AS "categoryName", c.color AS "categoryColor",
           au.username AS "authorUsername", coalesce(ap."displayName", au.username) AS "authorDisplayName",
           su.username AS "assigneeUsername", sp."displayName" AS "assigneeDisplayName",
           (SELECT count(*)::int FROM ticket_comments tc WHERE tc."ticketId" = t.id AND tc."deletedAt" IS NULL) AS "commentCount",
           (SELECT count(*)::int FROM attachments at2 WHERE at2."ticketId" = t.id AND at2."deletedAt" IS NULL) AS "attachmentCount",
           ${
             tsQuery
               ? Prisma.sql`ts_rank(to_tsvector('helpdesk_es', helpdesk_unaccent(coalesce(t.title,'') || ' ' || coalesce(t.description,''))), ${tsQuery})`
               : Prisma.sql`NULL::real`
           } AS rank
    FROM tickets t
    LEFT JOIN categories c    ON c.id = t."categoryId"
    JOIN users au             ON au.id = t."createdById"
    LEFT JOIN user_profiles ap ON ap."userId" = au.id
    LEFT JOIN users su        ON su.id = t."assignedToId"
    LEFT JOIN user_profiles sp ON sp."userId" = su.id
    ${whereSql}
    ${orderSql}
    LIMIT ${query.take} OFFSET ${offset}
  `);

  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
    SELECT count(*)::bigint AS count FROM tickets t ${whereSql}
  `);

  // Facets computed in ONE extra query with FILTER, not seven round trips.
  const facetRows = await prisma.$queryRaw<FacetRow[]>(Prisma.sql`
    SELECT t."status"::text AS status, t."priority"::text AS priority, count(*)::bigint AS count
    FROM tickets t ${whereSql}
    GROUP BY GROUPING SETS ((t."status"), (t."priority"))
  `);

  const facets = {
    status: {} as Record<string, number>,
    priority: {} as Record<string, number>,
  };
  for (const row of facetRows) {
    if (row.status) facets.status[row.status] = Number(row.count);
    else if (row.priority) facets.priority[row.priority] = Number(row.count);
  }

  return paginate(rows, Number(count), query.page, query.take, {
    tookMs: Date.now() - started,
    ...({ facets } as object),
  });
}
