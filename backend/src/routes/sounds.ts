import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination, parseBody } from "../lib/validate";
import { serializeVideo } from "../lib/serializers";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import {
  cloudinaryConfigured,
  configureCloudinary,
  deleteLocalFile,
  getVideoDuration,
  localUrl,
  resolveStoredPath,
  soundUpload,
  uploadToCloudinary,
} from "../lib/upload";

export const soundsRouter = Router();

const videoInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  sound: { select: { id: true, title: true, artist: true } },
  hashtags: { select: { tag: true } },
  _count: { select: { likes: true, comments: true, savedBy: true } },
} as const;

/**
 * Shared admin-only sound upload handler.
 * Used by BOTH POST /api/sounds (contract) and POST /api/admin/sounds
 * (what the built admin client actually calls).
 */
export const uploadSoundHandler = asyncHandler(async (req, res) => {
  const file = (req as Express.Request & { file?: Express.Multer.File }).file;
  if (!file) throw badRequest("An audio file is required");
  const body = parseBody(
    z.object({
      title: z.string().min(1).max(100),
      artist: z.string().min(1).max(100).optional().default("Alizain TikTok Originals"),
    }),
    req.body
  );

  // Reuse ffprobe for duration (it reads audio files too).
  const duration = await getVideoDuration(file.path).catch(() => null);
  if (duration === null) {
    deleteLocalFile(file.path);
    throw badRequest("Could not read the audio file");
  }

  let audioUrl: string;
  let filePath: string;
  if (cloudinaryConfigured()) {
    configureCloudinary();
    const uploaded = await uploadToCloudinary(file.path, { resourceType: "video", folder: "alizain-tiktok/sounds" });
    audioUrl = uploaded.secureUrl;
    filePath = uploaded.secureUrl; // cloudinary-hosted: stream redirects to the URL
    deleteLocalFile(file.path);
  } else {
    audioUrl = localUrl(`uploads/sounds/${file.filename}`);
    filePath = path.join("uploads", "sounds", file.filename);
  }

  const sound = await prisma.sound.create({
    data: {
      title: body.title,
      artist: body.artist,
      durationSec: Math.round(duration * 100) / 100,
      audioUrl,
      filePath,
    },
  });
  await logAudit({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: "sound.create",
    targetType: "sound",
    targetId: sound.id,
  });
  res.status(201).json({ ok: true, sound });
});

soundsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { artist: { contains: q, mode: "insensitive" } },
      ];
    }
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
    res.json({ ok: true, sounds: page, nextCursor });
  })
);

// Admin upload — also mounted at POST /api/admin/sounds (see admin router).
soundsRouter.post("/", requireAuth, requireRole("admin", "super_admin"), soundUpload.single("audio"), uploadSoundHandler);

soundsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
    if (!sound) throw notFound("Sound not found");
    const videosCount = await prisma.video.count({ where: { soundId: sound.id, status: "ready" } });
    res.json({ ok: true, sound: { ...sound, videosCount } });
  })
);

soundsRouter.get(
  "/:id/videos",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
    if (!sound) throw notFound("Sound not found");
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { soundId: sound.id, status: "ready" };
    if (cursor) {
      const cursorRow = await prisma.video.findUnique({ where: { id: cursor } });
      if (cursorRow) where.AND = [olderThan(cursorRow)];
    }
    const rows = await prisma.video.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: videoInclude,
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    let likedIds = new Set<string>();
    let savedIds = new Set<string>();
    if (req.user) {
      const ids = page.map((v) => v.id);
      likedIds = new Set((await prisma.like.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((l) => l.videoId));
      savedIds = new Set((await prisma.savedVideo.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((s) => s.videoId));
    }
    res.json({ ok: true, sound, videos: page.map((v) => serializeVideo(v, { likedIds, savedIds })), nextCursor });
  })
);

soundsRouter.get(
  "/:id/stream",
  asyncHandler(async (req, res) => {
    const sound = await prisma.sound.findUnique({ where: { id: req.params.id } });
    if (!sound) throw notFound("Sound not found");
    // Cloudinary-hosted sounds stream from their URL.
    if (sound.filePath.startsWith("http")) {
      res.redirect(sound.filePath);
      return;
    }
    const abs = resolveStoredPath(sound.filePath);
    if (!fs.existsSync(abs)) throw notFound("Audio file not found on disk");
    const ext = path.extname(abs).toLowerCase();
    const type =
      ext === ".wav" ? "audio/wav" : ext === ".mp3" ? "audio/mpeg" : ext === ".ogg" ? "audio/ogg" : "audio/mpeg";
    res.setHeader("Content-Type", type);
    res.setHeader("Accept-Ranges", "bytes");
    res.sendFile(abs);
  })
);
