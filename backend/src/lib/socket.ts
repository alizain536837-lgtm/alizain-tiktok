import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "./auth";
import { prisma } from "./prisma";

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export async function createNotification(opts: {
  userId: string;
  actorId?: string | null;
  type: string;
  videoId?: string | null;
  message: string;
}): Promise<void> {
  if (opts.userId === opts.actorId) return; // never notify yourself
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: opts.userId,
        actorId: opts.actorId ?? null,
        type: opts.type,
        videoId: opts.videoId ?? null,
        message: opts.message,
        read: false,
      },
      include: { actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    emitToUser(opts.userId, "notification:new", { ok: true, notification: notif });
  } catch {
    // Notifications must never break the action that triggered them.
  }
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  io = new SocketIOServer(httpServer, {
    cors: { origin: origins.length ? origins : true, credentials: true },
  });

  // Authenticate with the JWT access token:
  //   io(url, { auth: { token: "<accessToken>" } })
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("join", (data: { userId?: string }) => {
      // A client may (re)join its own room; joining someone else's is ignored.
      if (data?.userId && data.userId === userId) socket.join(`user:${userId}`);
    });

    socket.on("message:send", async (data: { conversationId?: string; text?: string }) => {
      try {
        const { conversationId, text } = data ?? {};
        if (!conversationId || !text || !text.trim()) return;
        const participant = await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!participant) return;
        const message = await prisma.message.create({
          data: { conversationId, senderId: userId, text: text.trim().slice(0, 2000) },
          include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        });
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        const others = await prisma.conversationParticipant.findMany({
          where: { conversationId, userId: { not: userId } },
          select: { userId: true },
        });
        for (const other of others) {
          emitToUser(other.userId, "message:new", { ok: true, message });
          await createNotification({
            userId: other.userId,
            actorId: userId,
            type: "message",
            message: `${socket.data.username} sent you a message`,
          });
        }
        socket.emit("message:new", { ok: true, message });
      } catch {
        socket.emit("message:error", { ok: false, error: "Could not send message" });
      }
    });

    socket.on("typing", (data: { conversationId?: string }) => {
      if (!data?.conversationId) return;
      socket.to(`user:${userId}`).emit("typing", { conversationId: data.conversationId, userId });
      // Broadcast to the other participants via their rooms.
      void prisma.conversationParticipant
        .findMany({ where: { conversationId: data.conversationId, userId: { not: userId } }, select: { userId: true } })
        .then((others) => {
          for (const o of others) emitToUser(o.userId, "typing", { conversationId: data.conversationId, userId });
        });
    });

    socket.on("disconnect", () => {
      // nothing to clean up; rooms are per-connection
    });
  });

  return io;
}
