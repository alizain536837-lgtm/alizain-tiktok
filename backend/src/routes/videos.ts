import { Router } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination, parseBody } from "../lib/validate";
import { serializeVideo } from "../lib/serializers";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { createNotification, emitToUser } from "../lib/socket";
import { logAudit } from "../lib/audit";
import {
  cloudinaryConfigured,
  configureCloudinary,
  deleteLocalFile,
  generateThumbnail,
  getVideoDuration,
  localUrl,
  uploadDir,
  uploadToCloudinary,
  videoUploadFields,
} from "../lib/upload";

export const videosRouter = Router();

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "anon"),
  handler: (_req, res) => res.status(429).json({ ok: false, error: "Too many comments, please slow down" }),
});

const videoInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  sound: { select: { id: true, title: true, artist: true } },
  hashtags: { select: { tag: true } },
  _count: { select: { likes: true, comments: true, savedBy: true } },
} as const;

async function likedAndSavedSets(viewerId: string | undefined, videoIds: string[]) {
  if (!viewerId || videoIds.length === 0) return { likedIds: new Set<string>(), savedIds: new Set<string>() };
  const [likes, saved] = await Promise.all([
    prisma.like.findMany({ where: { userId: viewerId, videoId: { in: videoIds } }, select: { videoId: true } }),
    prisma.savedVideo.findMany({ where: { userId: viewerId, videoId: { in: videoIds } }, select: { videoId: true } }),
  ]);
  return {
    likedIds: new Set(likes.map((l) => l.videoId)),
    savedIds: new Set(saved.map((s) => s.videoId)),
  };
}

async function maxVideoSeconds(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: "maxVideoSeconds" } });
  const n = setting ? parseFloat(setting.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function parseHashtags(raw: unknown): string[] {
  const tags: string[] = [];
  const add = (t: string) => {
    const clean = t.trim().replace(/^#/, "").toLowerCase();
    if (/^[a-z0-9_]{1,50}$/.test(clean) && !tags.includes(clean)) tags.push(clean);
  };
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach((t) => typeof t === "string" && add(t));
      else add(raw);
    } catch {
      raw.split(/[\s,]+/).forEach(add);
    }
  } else if (Array.isArray(raw)) {
    raw.forEach((t) => typeof t === "string" && add(t));
  }
  return tags;
}

function extractCaptionHashtags(caption: string): string[] {
  const tags: string[] = [];
  for (const m of caption.matchAll(/#([A-Za-z0-9_]{1,50})/g)) {
    const t = m[1].toLowerCase();
    if (!tags.includes(t)) tags.push(t);
  }
  return tags;
}

async function loadVideoOr404(id: string) {
  const video = await prisma.video.findUnique({ where: { id }, include: videoInclude });
  if (!video) throw notFound("Video not found");
  return video;
}

async function assertCanComment(viewerId: string, video: { authorId: string }) {
  const author = await prisma.user.findUnique({ where: { id: video.authorId } });
  if (!author) throw notFound("Video not found");
  if (author.commentPrivacy === "off" && viewerId !== author.id) {
    throw forbidden("Comments are turned off for this video");
  }
  if (author.commentPrivacy === "followers" && viewerId !== author.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: author.id } },
    });
    if (!follow) throw forbidden("Only followers can comment on this video");
  }
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: author.id, blockedId: viewerId },
        { blockerId: viewerId, blockedId: author.id },
      ],
    },
  });
  if (blocked) throw forbidden("You cannot comment on this video");
}

// ---- Upload ---------------------------------------------------------------
videosRouter.post(
  "/upload",
  requireAuth,
  videoUploadFields,
  asyncHandler(async (req, res) => {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const videoFile = files.video?.[0];
    const thumbFile = files.thumbnail?.[0];
    if (!videoFile) throw badRequest("A video file is required (mp4, mov or webm, max 100 MB)");

    const caption = String(req.body.caption ?? "").slice(0, 300);
    const soundId = typeof req.body.soundId === "string" && req.body.soundId ? req.body.soundId : null;
    if (soundId) {
      const sound = await prisma.sound.findUnique({ where: { id: soundId } });
      if (!sound) {
        deleteLocalFile(videoFile.path);
        if (thumbFile) deleteLocalFile(thumbFile.path);
        throw badRequest("Sound not found");
      }
    }

    const duration = await getVideoDuration(videoFile.path).catch(() => null);
    if (duration === null) {
      deleteLocalFile(videoFile.path);
      if (thumbFile) deleteLocalFile(thumbFile.path);
      throw badRequest("Could not read the video file");
    }
    const maxSeconds = await maxVideoSeconds();
    if (duration > maxSeconds) {
      deleteLocalFile(videoFile.path);
      if (thumbFile) deleteLocalFile(thumbFile.path);
      throw badRequest(`Video is too long (${duration.toFixed(1)}s). Maximum is ${maxSeconds} seconds.`);
    }

    // Thumbnail: supplied file, otherwise a frame grabbed with ffmpeg.
    let thumbPath: string | null = thumbFile ? thumbFile.path : null;
    let generatedThumb = false;
    if (!thumbPath) {
      const out = path.join(uploadDir(), "thumbnails", `${path.parse(videoFile.filename).name}.jpg`);
      try {
        await generateThumbnail(videoFile.path, out);
        thumbPath = out;
        generatedThumb = true;
      } catch {
        thumbPath = null;
      }
    }

    let videoUrl: string;
    let thumbnailUrl: string | null = null;
    if (cloudinaryConfigured()) {
      configureCloudinary();
      const uploaded = await uploadToCloudinary(videoFile.path, { resourceType: "video", folder: "alizain-tiktok/videos" });
      videoUrl = uploaded.secureUrl;
      if (thumbPath) {
        const up = await uploadToCloudinary(thumbPath, { resourceType: "image", folder: "alizain-tiktok/thumbnails" });
        thumbnailUrl = up.secureUrl;
      }
      deleteLocalFile(videoFile.path);
      deleteLocalFile(thumbPath ?? "");
      if (thumbFile) deleteLocalFile(thumbFile.path);
    } else {
      videoUrl = localUrl(`uploads/videos/${videoFile.filename}`);
      if (thumbPath) {
        const rel = path.relative(uploadDir(), thumbPath);
        thumbnailUrl = localUrl(path.join("uploads", rel));
      }
      if (generatedThumb) {
        // keep generated thumbnail on disk (it is the stored thumbnail)
      }
    }

    const tags = [...new Set([...parseHashtags(req.body.hashtags), ...extractCaptionHashtags(caption)])];
    const video = await prisma.video.create({
      data: {
        authorId: req.user!.id,
        caption,
        videoUrl,
        thumbnailUrl,
        durationSec: Math.round(duration * 100) / 100,
        status: "ready",
        soundId,
        hashtags: {
          create: tags.map((tag) => ({
            hashtag: { connectOrCreate: { where: { tag }, create: { tag } } },
          })),
        },
      },
      include: videoInclude,
    });
    res.status(201).json({ ok: true, video: serializeVideo(video) });
  })
);

// ---- Feed -----------------------------------------------------------------
videosRouter.get(
  "/feed",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const tab = req.query.tab === "following" ? "following" : "for_you";
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { status: "ready" };
    if (tab === "following") {
      if (!req.user) throw forbidden("Log in to see videos from people you follow");
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.id },
        select: { followingId: true },
      });
      where.authorId = { in: following.map((f) => f.followingId) };
    }
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
    const { likedIds, savedIds } = await likedAndSavedSets(req.user?.id, page.map((v) => v.id));
    res.json({ ok: true, videos: page.map((v) => serializeVideo(v, { likedIds, savedIds })), nextCursor });
  })
);

// ---- Single video ---------------------------------------------------------
videosRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await loadVideoOr404(req.params.id);
    if (video.status === "removed") throw notFound("Video not found");
    const { likedIds, savedIds } = await likedAndSavedSets(req.user?.id, [video.id]);
    res.json({ ok: true, video: serializeVideo(video, { likedIds, savedIds }) });
  })
);

videosRouter.post(
  "/:id/view",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video || video.status === "removed") throw notFound("Video not found");
    const viewerId = req.user?.id;
    if (viewerId) {
      const day = new Date().toISOString().slice(0, 10);
      const existing = await prisma.videoView.findUnique({
        where: { userId_videoId_day: { userId: viewerId, videoId: video.id, day } },
      });
      if (!existing) {
        await prisma.$transaction([
          prisma.videoView.create({ data: { userId: viewerId, videoId: video.id, day } }),
          prisma.video.update({ where: { id: video.id }, data: { views: { increment: 1 } } }),
        ]);
      }
    } else {
      // Anonymous view: no identity to dedupe against, count every call.
      await prisma.video.update({ where: { id: video.id }, data: { views: { increment: 1 } } });
    }
    const updated = await prisma.video.findUnique({ where: { id: video.id }, select: { views: true } });
    res.json({ ok: true, views: updated?.views ?? video.views });
  })
);

videosRouter.post(
  "/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const video = await loadVideoOr404(req.params.id);
    if (video.status === "removed") throw notFound("Video not found");
    await prisma.like.upsert({
      where: { userId_videoId: { userId: req.user!.id, videoId: video.id } },
      create: { userId: req.user!.id, videoId: video.id },
      update: {},
    });
    await createNotification({
      userId: video.authorId,
      actorId: req.user!.id,
      type: "like",
      videoId: video.id,
      message: `${req.user!.username} liked your video`,
    });
    const likesCount = await prisma.like.count({ where: { videoId: video.id } });
    res.json({ ok: true, isLiked: true, likesCount });
  })
);

videosRouter.delete(
  "/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.like
      .delete({ where: { userId_videoId: { userId: req.user!.id, videoId: req.params.id } } })
      .catch(() => undefined);
    const likesCount = await prisma.like.count({ where: { videoId: req.params.id } });
    res.json({ ok: true, isLiked: false, likesCount });
  })
);

videosRouter.post(
  "/:id/save",
  requireAuth,
  asyncHandler(async (req, res) => {
    const video = await loadVideoOr404(req.params.id);
    if (video.status === "removed") throw notFound("Video not found");
    await prisma.savedVideo.upsert({
      where: { userId_videoId: { userId: req.user!.id, videoId: video.id } },
      create: { userId: req.user!.id, videoId: video.id },
      update: {},
    });
    res.json({ ok: true, isSaved: true });
  })
);

videosRouter.delete(
  "/:id/save",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.savedVideo
      .delete({ where: { userId_videoId: { userId: req.user!.id, videoId: req.params.id } } })
      .catch(() => undefined);
    res.json({ ok: true, isSaved: false });
  })
);

videosRouter.post(
  "/:id/share",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video || video.status === "removed") throw notFound("Video not found");
    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { shares: { increment: 1 } },
      select: { shares: true },
    });
    const base = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
    res.json({ ok: true, shareUrl: `${base}/video/${video.id}`, sharesCount: updated.shares });
  })
);

videosRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) throw notFound("Video not found");
    const isAdmin = req.user!.role === "admin" || req.user!.role === "super_admin";
    if (video.authorId !== req.user!.id && !isAdmin) throw forbidden("You cannot delete this video");
    await prisma.video.update({ where: { id: video.id }, data: { status: "removed" } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "video.delete",
      targetType: "video",
      targetId: video.id,
    });
    res.json({ ok: true });
  })
);

videosRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({ reason: z.string().min(1).max(200), details: z.string().max(1000).optional() }),
      req.body
    );
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) throw notFound("Video not found");
    const report = await prisma.report.create({
      data: { reporterId: req.user!.id, targetType: "video", targetId: video.id, reason: body.reason, details: body.details },
    });
    res.status(201).json({ ok: true, report: { id: report.id, status: report.status } });
  })
);

// ---- Comments -------------------------------------------------------------
videosRouter.get(
  "/:id/comments",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video || video.status === "removed") throw notFound("Video not found");
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { videoId: video.id, parentId: null };
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
        _count: { select: { likes: true, replies: true } },
      },
    });
    const { page, nextCursor } = cursorPage(rows, limit);
    let likedIds = new Set<string>();
    if (req.user) {
      likedIds = new Set(
        (await prisma.commentLike.findMany({
          where: { userId: req.user.id, commentId: { in: page.map((c) => c.id) } },
          select: { commentId: true },
        })).map((l) => l.commentId)
      );
    }
    res.json({
      ok: true,
      comments: page.map((c) => ({
        id: c.id,
        videoId: c.videoId,
        text: c.text,
        parentId: c.parentId,
        createdAt: c.createdAt,
        author: c.author,
        likesCount: c._count.likes,
        repliesCount: c._count.replies,
        isLiked: likedIds.has(c.id),
      })),
      nextCursor,
    });
  })
);

videosRouter.post(
  "/:id/comments",
  requireAuth,
  commentLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({ text: z.string().min(1).max(500), parentId: z.string().optional() }),
      req.body
    );
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video || video.status === "removed") throw notFound("Video not found");
    await assertCanComment(req.user!.id, video);
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.videoId !== video.id) throw badRequest("Parent comment not found on this video");
    }
    const comment = await prisma.comment.create({
      data: {
        videoId: video.id,
        authorId: req.user!.id,
        text: body.text.trim(),
        parentId: body.parentId ?? null,
      },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    await createNotification({
      userId: video.authorId,
      actorId: req.user!.id,
      type: "comment",
      videoId: video.id,
      message: `${req.user!.username} commented on your video`,
    });
    res.status(201).json({
      ok: true,
      comment: {
        id: comment.id,
        videoId: comment.videoId,
        text: comment.text,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        author: comment.author,
        likesCount: 0,
        repliesCount: 0,
        isLiked: false,
      },
    });
  })
);

videosRouter.post(
  "/comments/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) throw notFound("Comment not found");
    await prisma.commentLike.upsert({
      where: { userId_commentId: { userId: req.user!.id, commentId: comment.id } },
      create: { userId: req.user!.id, commentId: comment.id },
      update: {},
    });
    const likesCount = await prisma.commentLike.count({ where: { commentId: comment.id } });
    res.json({ ok: true, isLiked: true, likesCount });
  })
);

videosRouter.delete(
  "/comments/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.commentLike
      .delete({ where: { userId_commentId: { userId: req.user!.id, commentId: req.params.id } } })
      .catch(() => undefined);
    const likesCount = await prisma.commentLike.count({ where: { commentId: req.params.id } });
    res.json({ ok: true, isLiked: false, likesCount });
  })
);

videosRouter.delete(
  "/comments/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) throw notFound("Comment not found");
    const isAdmin = req.user!.role === "admin" || req.user!.role === "super_admin";
    if (comment.authorId !== req.user!.id && !isAdmin) throw forbidden("You cannot delete this comment");
    await prisma.comment.delete({ where: { id: comment.id } });
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "comment.delete",
      targetType: "comment",
      targetId: comment.id,
    });
    // Notify the video owner so the socket layer stays in sync (no-op if self).
    emitToUser(comment.authorId, "comment:deleted", { ok: true, commentId: comment.id });
    res.json({ ok: true });
  })
);
