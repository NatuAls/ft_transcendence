export interface PageMeta {
  total: number;
  page: number;
  take: number;
  pages: number;
  nextCursor?: string | null;
  tookMs?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Hard cap so no caller can ever ask the database for an unbounded page. */
export const MAX_TAKE = 100;

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  take: number,
  extra: Partial<PageMeta> = {},
): Paginated<T> {
  const safeTake = Math.min(Math.max(take, 1), MAX_TAKE);
  return {
    data,
    meta: {
      total,
      page,
      take: safeTake,
      pages: Math.max(1, Math.ceil(total / safeTake)),
      ...extra,
    },
  };
}

export function encodeCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(`${value.createdAt.toISOString()}|${value.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}
