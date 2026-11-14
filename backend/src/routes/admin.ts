import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { hashPassword, newRefreshToken, signAccessToken, verifyPassword } from "../lib/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination, parseBody } from "../lib/validate";
import { publicUser } from "../lib/serializers";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { cloudinaryConfigured, deleteLocalFile, soundUpload, uploadDir } from "../lib/upload";
import { uploadSoundHandler } from "./sounds";

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole("admin", "super_admin")] as const;

/** Keys whose values are secrets: never returned, only overwritten. */
const SECRET_KEY_HINTS = ["SECRET", "KEY", "PASSWORD", "TOKEN", "CLOUDINARY_API_SECRET", "LIVE_API_SECRET"];
function isSecretKey(key: string): boolean {
  const k = key.toUpperCase();
  return SECRET_KEY_HINTS.some((h) => k.includes(h));
}

// ---- First-use setup + admin login (public) -------------------------------
adminRouter.post(
  "/setup",
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().min(1).max(50),
        email: z.string().email().transform((v) => v.toLowerCase()),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
      req.body
    );
    const existing = await prisma.user.findFirst({ where: { role: "super_admin" } });
    if (existing) throw forbidden("A Super Admin already exists");
    const emailTaken = await prisma.user.findUnique({ where: { email: body.email } });
    if (emailTaken) throw conflict("Email is already registered");
    const usernameBase = body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "") || "admin";
    let username = usernameBase.slice(0, 30);
    let n = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${usernameBase.slice(0, 28)}${n++}`;
    }
    const user = await prisma.user.create({
      data: {
        username,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.name,
        role: "super_admin",
      },
    });
    await logAudit({ actorId: user.id, actorRole: "super_admin", action: "admin.setup", targetType: "user", targetId: user.id });
    const refresh = newRefreshToken();
    await prisma.session.create({ data: { userId: user.id, refreshTokenHash: refresh.hash, expiresAt: refresh.expiresAt } });
    res.status(201).json({ ok: true, user: publicUser(user), accessToken: signAccessToken(user), refreshToken: refresh.token });
  })
);

adminRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = parseBody(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) throw forbidden("Invalid admin credentials");
    if (user.role !== "admin" && user.role !== "super_admin") throw forbidden("Not an admin account");
    if (user.status === "suspended") throw forbidden("Account suspended");
    if (!(await verifyPassword(body.password, user.passwordHash))) throw forbidden("Invalid admin credentials");
    const refresh = newRefreshToken();
    await prisma.session.create({ data: { userId: user.id, refreshTokenHash: refresh.hash, expiresAt: refresh.expiresAt } });
    res.json({ ok: true, user: publicUser(user), accessToken: signAccessToken(user), refreshToken: refresh.token });
  })
);

// ---- All routes below require admin/super_admin ---------------------------
adminRouter.use(...adminOnly);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [totalUsers, totalVideos, totalComments, totalReportsOpen, totalLiveStreams, totalLikes] = await Promise.all([
      prisma.user.count(),
      prisma.video.count({ where: { status: "ready" } }),
      prisma.comment.count(),
      prisma.report.count({ where: { status: "open" } }),
      prisma.liveStream.count({ where: { status: "live" } }),
      prisma.like.count(),
    ]);
    res.json({
      ok: true,
      stats: { totalUsers, totalVideos, totalComments, totalReportsOpen, totalLiveStreams, totalLikes },
    });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { username: { contains: search.toLowerCase(), mode: "insensitive" } },
        { email: { contains: search.toLowerCase(), mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status === "active" || status === "suspended") where.status = status;
    if (cursor) {
      const cursorRow = await prisma.user.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, users: page.map(publicUser), nextCursor });
  })
);

adminRouter.post(
  "/users/:id/suspend",
  asyncHandler(async (req, res) => {
    const body = parseBody(z.object({ reason: z.string().max(500).optional() }), req.body ?? {});
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound("User not found");
    if (user.role === "super_admin") throw forbidden("A Super Admin cannot be suspended");
    await prisma.user.update({ where: { id: user.id }, data: { status: "suspended" } });
    // Suspended users are logged out everywhere.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "user.suspend",
      targetType: "user",
      targetId: user.id,
      details: body.reason,
    });
    res.json({ ok: true, user: publicUser({ ...user, status: "suspended" }) });
  })
);

adminRouter.post(
  "/users/:id/restore",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound("User not found");
    await prisma.user.update({ where: { id: user.id }, data: { status: "active" } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "user.restore",
      targetType: "user",
      targetId: user.id,
    });
    res.json({ ok: true, user: publicUser({ ...user, status: "active" }) });
  })
);

adminRouter.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (cursor) {
      const cursorRow = await prisma.video.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.video.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        sound: { select: { id: true, title: true, artist: true } },
        hashtags: { select: { tag: true } },
        _count: { select: { likes: true, comments: true, savedBy: true } },
      },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, videos: page, nextCursor });
  })
);

adminRouter.delete(
  "/videos/:id",
  asyncHandler(async (req, res) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) throw notFound("Video not found");
    await prisma.video.update({ where: { id: video.id }, data: { status: "removed" } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "video.delete",
      targetType: "video",
      targetId: video.id,
      details: "Removed by admin",
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  "/comments",
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (cursor) {
      const cursorRow = await prisma.comment.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        video: { select: { id: true, caption: true, thumbnailUrl: true } },
        _count: { select: { likes: true } },
      },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, comments: page, nextCursor });
  })
);

adminRouter.delete(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) throw notFound("Comment not found");
    await prisma.comment.delete({ where: { id: comment.id } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "comment.delete",
      targetType: "comment",
      targetId: comment.id,
      details: "Deleted by admin",
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? "").trim();
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (status === "open" || status === "reviewed" || status === "dismissed") where.status = status;
    if (cursor) {
      const cursorRow = await prisma.report.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.report.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, reports: page, nextCursor });
  })
);

adminRouter.post(
  "/reports/:id/review",
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        action: z.enum(["dismiss", "remove_content", "suspend_user"]),
        note: z.string().max(1000).optional(),
      }),
      req.body
    );
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw notFound("Report not found");
    if (report.status !== "open") throw badRequest("Report has already been reviewed");

    if (body.action === "dismiss") {
      await prisma.report.update({ where: { id: report.id }, data: { status: "dismissed" } });
    } else if (body.action === "remove_content") {
      if (report.targetType === "video") {
        await prisma.video.updateMany({ where: { id: report.targetId }, data: { status: "removed" } });
      } else if (report.targetType === "comment") {
        await prisma.comment.deleteMany({ where: { id: report.targetId } });
      } else if (report.targetType === "live") {
        await prisma.liveStream.updateMany({ where: { id: report.targetId }, data: { status: "ended" } });
      }
      await prisma.report.update({ where: { id: report.id }, data: { status: "reviewed" } });
    } else {
      // suspend_user: suspend the reported user, or the author of the reported content.
      let userId: string | null = null;
      if (report.targetType === "user") userId = report.targetId;
      else if (report.targetType === "video") {
        const v = await prisma.video.findUnique({ where: { id: report.targetId }, select: { authorId: true } });
        userId = v?.authorId ?? null;
      } else if (report.targetType === "comment") {
        const c = await prisma.comment.findUnique({ where: { id: report.targetId }, select: { authorId: true } });
        userId = c?.authorId ?? null;
      } else if (report.targetType === "live") {
        const s = await prisma.liveStream.findUnique({ where: { id: report.targetId }, select: { hostId: true } });
        userId = s?.hostId ?? null;
      }
      if (userId) {
        const target = await prisma.user.findUnique({ where: { id: userId } });
        if (target && target.role !== "super_admin") {
          await prisma.user.update({ where: { id: userId }, data: { status: "suspended" } });
          await prisma.session.deleteMany({ where: { userId } });
        }
      }
      await prisma.report.update({ where: { id: report.id }, data: { status: "reviewed" } });
    }
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: `report.review:${body.action}`,
      targetType: "report",
      targetId: report.id,
      details: body.note ?? `${report.targetType}:${report.targetId}`,
    });
    const updated = await prisma.report.findUnique({ where: { id: report.id } });
    res.json({ ok: true, report: updated });
  })
);

adminRouter.get(
  "/sounds",
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (cursor) {
      const cursorRow = await prisma.sound.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.sound.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    const sounds = [];
    for (const s of page) {
      const videosCount = await prisma.video.count({ where: { soundId: s.id } });
      sounds.push({ ...s, videosCount });
    }
    res.json({ ok: true, sounds, nextCursor });
  })
);

// Admin sound upload — the admin client posts here (POST /api/admin/sounds).
// The same handler is also mounted at POST /api/sounds (see sounds router).
adminRouter.post("/sounds", soundUpload.single("audio"), uploadSoundHandler);

adminRouter.delete(
  "/sounds/:id",
  asyncHandler(async (req, res) => {
    const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
    if (!sound) throw notFound("Sound not found");
    await prisma.sound.delete({ where: { id: sound.id } });
    if (!sound.filePath.startsWith("http") && sound.filePath.startsWith("uploads/")) {
      deleteLocalFile(path.resolve(uploadDir(), sound.filePath.replace(/^uploads\//, "")));
    }
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "sound.delete",
      targetType: "sound",
      targetId: sound.id,
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  "/hashtags",
  asyncHandler(async (req, res) => {
    const { limit } = pagination(req);
    const groups = await prisma.videoHashtag.groupBy({
      by: ["tag"],
      _count: { tag: true },
      orderBy: { _count: { tag: "desc" } },
      take: limit,
    });
    res.json({ ok: true, hashtags: groups.map((g) => ({ tag: g.tag, videosCount: g._count.tag })) });
  })
);

adminRouter.delete(
  "/hashtags/:tag",
  asyncHandler(async (req, res) => {
    const tag = req.params.tag.replace(/^#/, "").toLowerCase();
    await prisma.$transaction([
      prisma.videoHashtag.deleteMany({ where: { tag } }),
      prisma.hashtag.deleteMany({ where: { tag } }),
    ]);
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "hashtag.delete",
      targetType: "hashtag",
      targetId: tag,
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  "/creators",
  asyncHandler(async (req, res) => {
    const { limit } = pagination(req);
    const users = await prisma.user.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const creators = [];
    for (const u of users) {
      const [followers, videosCount, totalViews, totalLikes] = await Promise.all([
        prisma.follow.count({ where: { followingId: u.id } }),
        prisma.video.count({ where: { authorId: u.id, status: "ready" } }),
        prisma.video.aggregate({ where: { authorId: u.id, status: "ready" }, _sum: { views: true } }),
        prisma.like.count({ where: { video: { authorId: u.id, status: "ready" } } }),
      ]);
      creators.push({
        ...publicUser(u),
        followers,
        videosCount,
        totalViews: totalViews._sum.views ?? 0,
        totalLikes,
      });
    }
    creators.sort((a, b) => b.followers - a.followers || b.totalViews - a.totalViews);
    res.json({ ok: true, creators: creators.slice(0, limit) });
  })
);

adminRouter.get(
  "/announcements",
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (cursor) {
      const cursorRow = await prisma.announcement.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.announcement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { createdBy: { select: { id: true, username: true, displayName: true } } },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, announcements: page, nextCursor });
  })
);

adminRouter.post(
  "/announcements",
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({ title: z.string().min(1).max(200), body: z.string().min(1).max(5000) }),
      req.body
    );
    const announcement = await prisma.announcement.create({
      data: { title: body.title, body: body.body, createdById: req.user!.id },
      include: { createdBy: { select: { id: true, username: true, displayName: true } } },
    });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "announcement.create",
      targetType: "announcement",
      targetId: announcement.id,
    });
    res.status(201).json({ ok: true, announcement });
  })
);

adminRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    const settings: Record<string, string> = {};
    for (const row of rows) {
      // Secrets are write-only: never returned, shown only as masked.
      settings[row.key] = isSecretKey(row.key) ? "********" : row.value;
    }
    res.json({ ok: true, settings });
  })
);

adminRouter.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = parseBody(z.record(z.string(), z.string().max(2000)), req.body);
    const updated: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) throw badRequest(`Invalid setting key: ${key}`);
      // Sending back the masked placeholder must not overwrite a secret.
      if (isSecretKey(key) && value === "********") continue;
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      updated[key] = isSecretKey(key) ? "********" : value;
    }
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "settings.update",
      targetType: "setting",
      targetId: Object.keys(updated).join(",") || "settings",
      details: `Updated: ${Object.keys(updated).join(", ")}`,
    });
    res.json({ ok: true, settings: updated });
  })
);

adminRouter.get(
  "/storage",
  asyncHandler(async (_req, res) => {
    const provider = cloudinaryConfigured() ? "cloudinary" : "local";
    let videosBytes = 0;
    let totalBytes = 0;
    let videosCount = 0;
    if (provider === "local") {
      const walk = (dir: string): number => {
        let total = 0;
        if (!fs.existsSync(dir)) return 0;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) total += walk(p);
          else if (entry.isFile()) total += fs.statSync(p).size;
        }
        return total;
      };
      const videosDir = path.join(uploadDir(), "videos");
      videosBytes = walk(videosDir);
      totalBytes = walk(uploadDir());
      videosCount = await prisma.video.count({ where: { status: "ready" } });
    } else {
      videosCount = await prisma.video.count({ where: { status: "ready" } });
    }
    res.json({
      ok: true,
      storage: {
        provider,
        videosBytes,
        totalBytes,
        videosCount,
        note:
          provider === "local"
            ? "Videos are stored on local disk under UPLOAD_DIR. Set CLOUDINARY_* env vars to use Cloudinary."
            : "Videos are stored in Cloudinary. Byte totals are not tracked locally when using Cloudinary.",
      },
    });
  })
);

adminRouter.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (cursor) {
      const cursorRow = await prisma.auditLog.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { actor: { select: { id: true, username: true, displayName: true } } },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    res.json({ ok: true, auditLogs: page, nextCursor });
  })
);

adminRouter.get(
  "/live",
  asyncHandler(async (_req, res) => {
    const providerSetting = await prisma.setting.findUnique({ where: { key: "liveProvider" } });
    const provider = providerSetting?.value || process.env.LIVE_PROVIDER || "none";
    const streams = await prisma.liveStream.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { host: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    res.json({
      ok: true,
      live: { provider, available: provider !== "none", streams },
    });
  })
);
