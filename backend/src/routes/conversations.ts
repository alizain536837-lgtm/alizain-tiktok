import { Router } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination, parseBody } from "../lib/validate";
import { publicUser } from "../lib/serializers";
import { requireAuth } from "../middleware/auth";
import { createNotification, emitToUser } from "../lib/socket";

export const conversationsRouter = Router();

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "anon"),
  handler: (_req, res) => res.status(429).json({ ok: false, error: "Too many messages, please slow down" }),
});

async function loadConversationOr404(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: true },
  });
  if (!participant) throw notFound("Conversation not found");
  return participant.conversation;
}

async function serializeConversation(conversationId: string, viewerId: string) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: viewerId } },
    include: { user: true },
  });
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });
  const unreadCount = await prisma.message.count({
    where: { conversationId, senderId: { not: viewerId }, read: false },
  });
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  return {
    id: conversationId,
    participants: participants.map((p) => publicUser(p.user)),
    lastMessage: lastMessage
      ? { id: lastMessage.id, text: lastMessage.text, createdAt: lastMessage.createdAt, sender: lastMessage.sender }
      : null,
    unreadCount,
    updatedAt: conversation?.updatedAt ?? null,
    createdAt: conversation?.createdAt ?? null,
  };
}

conversationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { userId: req.user!.id };
    if (cursor) {
      const cursorConv = await prisma.conversation.findUnique({ where: { id: cursor } });
      if (cursorConv) {
        where.AND = [
          {
            OR: [
              { conversation: { updatedAt: { lt: cursorConv.updatedAt } } },
              { conversation: { updatedAt: cursorConv.updatedAt }, conversationId: { lt: cursorConv.id } },
            ],
          },
        ];
      }
    }
    const rows = await prisma.conversationParticipant.findMany({
      where,
      orderBy: [{ conversation: { updatedAt: "desc" } }, { conversationId: "desc" }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const conversations = [];
    for (const row of page) {
      conversations.push(await serializeConversation(row.conversationId, req.user!.id));
    }
    res.json({
      ok: true,
      conversations,
      nextCursor: hasMore ? page[page.length - 1].conversationId : undefined,
    });
  })
);

conversationsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = parseBody(z.object({ userId: z.string().min(1) }), req.body);
    if (userId === req.user!.id) throw badRequest("You cannot message yourself");
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw notFound("User not found");
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user!.id, blockedId: userId },
          { blockerId: userId, blockedId: req.user!.id },
        ],
      },
    });
    if (blocked) throw forbidden("You cannot message this user");
    // Find an existing 1:1 conversation.
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: { every: { userId: { in: [req.user!.id, userId] } } },
        AND: [{ participants: { some: { userId: req.user!.id } } }, { participants: { some: { userId } } }],
      },
      include: { participants: true },
    });
    const oneToOne =
      existing && existing.participants.length === 2 ? existing : null;
    if (oneToOne) {
      res.json({ ok: true, conversation: await serializeConversation(oneToOne.id, req.user!.id) });
      return;
    }
    const created = await prisma.conversation.create({
      data: {
        participants: { create: [{ userId: req.user!.id }, { userId }] },
      },
    });
    res.status(201).json({ ok: true, conversation: await serializeConversation(created.id, req.user!.id) });
  })
);

conversationsRouter.get(
  "/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    await loadConversationOr404(req.params.id, req.user!.id);
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { conversationId: req.params.id };
    if (cursor) {
      const cursorRow = await prisma.message.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.message.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({
      ok: true,
      // Oldest first within the page, so a chat UI can render top-to-bottom.
      messages: [...page].reverse().map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        text: m.text,
        read: m.read,
        createdAt: m.createdAt,
        sender: m.sender,
      })),
      nextCursor,
    });
  })
);

conversationsRouter.post(
  "/:id/messages",
  requireAuth,
  messageLimiter,
  asyncHandler(async (req, res) => {
    const conversation = await loadConversationOr404(req.params.id, req.user!.id);
    const { text } = parseBody(z.object({ text: z.string().min(1).max(2000) }), req.body);
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: req.user!.id, text: text.trim() },
      include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    const others = await prisma.conversationParticipant.findMany({
      where: { conversationId: conversation.id, userId: { not: req.user!.id } },
      select: { userId: true },
    });
    for (const other of others) {
      emitToUser(other.userId, "message:new", { ok: true, message });
      await createNotification({
        userId: other.userId,
        actorId: req.user!.id,
        type: "message",
        message: `${req.user!.username} sent you a message`,
      });
    }
    res.status(201).json({
      ok: true,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        text: message.text,
        read: message.read,
        createdAt: message.createdAt,
        sender: message.sender,
      },
    });
  })
);

conversationsRouter.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversation = await loadConversationOr404(req.params.id, req.user!.id);
    const updated = await prisma.message.updateMany({
      where: { conversationId: conversation.id, senderId: { not: req.user!.id }, read: false },
      data: { read: true },
    });
    const others = await prisma.conversationParticipant.findMany({
      where: { conversationId: conversation.id, userId: { not: req.user!.id } },
      select: { userId: true },
    });
    for (const other of others) {
      emitToUser(other.userId, "message:read", { ok: true, conversationId: conversation.id, readBy: req.user!.id });
    }
    res.json({ ok: true, markedRead: updated.count });
  })
);
