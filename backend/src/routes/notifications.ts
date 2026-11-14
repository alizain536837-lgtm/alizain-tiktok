import { Router } from "express";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination } from "../lib/validate";
import { requireAuth } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { userId: req.user!.id };
    if (cursor) {
      const cursorRow = await prisma.notification.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        video: { select: { id: true, thumbnailUrl: true, caption: true } },
      },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
    res.json({ ok: true, notifications: page, unreadCount, nextCursor });
  })
);

notificationsRouter.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const updated = await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ ok: true, markedRead: updated.count });
  })
);

notificationsRouter.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif || notif.userId !== req.user!.id) throw notFound("Notification not found");
    await prisma.notification.update({ where: { id: notif.id }, data: { read: true } });
    res.json({ ok: true });
  })
);
