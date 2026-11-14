import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { badRequest } from "./errors";

/** Validate req.body against a zod schema; throws 400 ApiError on failure. Returns the OUTPUT type (after transforms/defaults). */
export function parseBody<Out, In = unknown>(
  schema: z.ZodType<Out, z.ZodTypeDef, In>,
  body: unknown
): Out {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first ? `${first.path.join(".")}: ${first.message}` : "Invalid request body");
  }
  return result.data;
}

/** Validate req.query against a zod schema (all values arrive as strings). */
export function parseQuery<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first ? `${first.path.join(".")}: ${first.message}` : "Invalid query");
  }
  return result.data;
}

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 10 : parseInt(v, 10);
      if (Number.isNaN(n)) return 10;
      return Math.min(50, Math.max(1, n));
    }),
  cursor: z.string().optional(),
});

/** limit (1-50, default 10) + optional opaque cursor (a row id). */
export function pagination(req: Request): { limit: number; cursor?: string } {
  return parseQuery(paginationSchema, req.query);
}

/**
 * Keyset pagination helper for queries ordered by createdAt DESC, id DESC.
 * Returns the `where` fragment to apply after a cursor row, plus a function
 * that builds { nextCursor } from the fetched rows.
 */
export function cursorPage<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { page, nextCursor: hasMore ? page[page.length - 1].id : undefined };
}

export async function findCursorRow<T extends { id: string; createdAt: Date }>(
  cursor: string | undefined,
  find: (id: string) => Promise<T | null>
): Promise<T | null> {
  if (!cursor) return null;
  return find(cursor);
}

/** createdAt/id keyset filter for "older than cursor row". */
export function olderThan(cursorRow: { createdAt: Date; id: string }) {
  return {
    OR: [
      { createdAt: { lt: cursorRow.createdAt } },
      { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
    ],
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
