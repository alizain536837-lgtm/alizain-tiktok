import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination, parseBody } from "../lib/validate";
import { publicUser, serializeVideo } from "../lib/serializers";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { createNotification } from "../lib/socket";
import { logAudit } from "../lib/audit";

export const usersRouter = Router();

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isPrivate: z.boolean().optional(),
  commentPrivacy: z.enum(["everyone", "followers", "off"]).optional(),
});

async function loadUserByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user) throw notFound("User not found");
  return user;
}

async function isBlocked(aId: string, bId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
  });
  return Boolean(block);
}

async function canSeeVideos(viewerId: string | undefined, target: { id: string; isPrivate: boolean }) {
  if (!target.isPrivate) return true;
  if (!viewerId) return false;
  if (viewerId === target.id) return true;
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
  });
  return Boolean(follow);
}

usersRouter.get(
  "/search",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) throw badRequest("Query parameter q is required");
    const users = await prisma.user.findMany({
      where: {
        status: "active",
        OR: [
          { username: { contains: q.toLowerCase(), mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { username: "asc" },
      take: 20,
    });
    res.json({ ok: true, users: users.map(publicUser) });
  })
);

usersRouter.get(
  "/me/videos",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { authorId: req.user!.id, status: "ready" };
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
    const likedIds = new Set(
      (await prisma.like.findMany({ where: { userId: req.user!.id, videoId: { in: page.map((v) => v.id) } }, select: { videoId: true } })).map((l) => l.videoId)
    );
    const savedIds = new Set(
      (await prisma.savedVideo.findMany({ where: { userId: req.user!.id, videoId: { in: page.map((v) => v.id) } }, select: { videoId: true } })).map((s) => s.videoId)
    );
    res.json({ ok: true, videos: page.map((v) => serializeVideo(v, { likedIds, savedIds })), nextCursor });
  })
);

usersRouter.get(
  "/me/saved",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { userId: req.user!.id, video: { status: "ready" } };
    if (cursor) {
      const cursorRow = await prisma.savedVideo.findUnique({ where: { userId_videoId: { userId: req.user!.id, videoId: cursor } } });
      if (cursorRow) {
        where.AND = [
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, videoId: { lt: cursorRow.videoId } },
            ],
          },
        ];
      }
    }
    const rows = await prisma.savedVideo.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { videoId: "desc" }],
      take: limit + 1,
      include: {
        video: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            sound: { select: { id: true, title: true, artist: true } },
            hashtags: { select: { tag: true } },
            _count: { select: { likes: true, comments: true, savedBy: true } },
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const videos = page.map((r) => r.video);
    const likedIds = new Set(
      (await prisma.like.findMany({ where: { userId: req.user!.id, videoId: { in: videos.map((v) => v.id) } }, select: { videoId: true } })).map((l) => l.videoId)
    );
    const savedIds = new Set(videos.map((v) => v.id));
    res.json({
      ok: true,
      videos: videos.map((v) => serializeVideo(v, { likedIds, savedIds })),
      nextCursor: hasMore ? page[page.length - 1].videoId : undefined,
    });
  })
);

usersRouter.get(
  "/:username",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const target = await loadUserByUsername(req.params.username);
    const viewerId = req.user?.id;
    const [followersCount, followingCount, videosCount, totalLikes, isFollowing, isBlockedByMe] =
      await Promise.all([
        prisma.follow.count({ where: { followingId: target.id } }),
        prisma.follow.count({ where: { followerId: target.id } }),
        prisma.video.count({ where: { authorId: target.id, status: "ready" } }),
        prisma.like.count({ where: { video: { authorId: target.id, status: "ready" } } }),
        viewerId
          ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: target.id } } })
          : null,
        viewerId
          ? prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: target.id } } })
          : null,
      ]);
    res.json({
      ok: true,
      user: {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
        bio: target.bio,
        followersCount,
        followingCount,
        totalLikes,
        videosCount,
        isPrivate: target.isPrivate,
        isFollowing: Boolean(isFollowing),
        isBlockedByMe: Boolean(isBlockedByMe),
        createdAt: target.createdAt,
      },
    });
  })
);

usersRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(updateMeSchema, req.body);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: body });
    res.json({ ok: true, user: publicUser(user) });
  })
);

usersRouter.get(
  "/:username/videos",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const target = await loadUserByUsername(req.params.username);
    if (!(await canSeeVideos(req.user?.id, target))) {
      throw forbidden("This account is private");
    }
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { authorId: target.id, status: "ready" };
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
    let likedIds = new Set<string>();
    let savedIds = new Set<string>();
    if (req.user) {
      const ids = page.map((v) => v.id);
      likedIds = new Set((await prisma.like.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((l) => l.videoId));
      savedIds = new Set((await prisma.savedVideo.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((s) => s.videoId));
    }
    res.json({ ok: true, videos: page.map((v) => serializeVideo(v, { likedIds, savedIds })), nextCursor });
  })
);

usersRouter.get(
  "/:username/followers",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const target = await loadUserByUsername(req.params.username);
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { followingId: target.id };
    if (cursor) {
      const cursorRow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: cursor, followingId: target.id } },
      });
      if (cursorRow) {
        where.AND = [
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, followerId: { lt: cursorRow.followerId } },
            ],
          },
        ];
      }
    }
    const rows = await prisma.follow.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: limit + 1,
      include: { follower: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      ok: true,
      users: page.map((r) => publicUser(r.follower)),
      nextCursor: hasMore ? page[page.length - 1].followerId : undefined,
    });
  })
);

usersRouter.get(
  "/:username/following",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const target = await loadUserByUsername(req.params.username);
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { followerId: target.id };
    if (cursor) {
      const cursorRow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: target.id, followingId: cursor } },
      });
      if (cursorRow) {
        where.AND = [
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, followingId: { lt: cursorRow.followingId } },
            ],
          },
        ];
      }
    }
    const rows = await prisma.follow.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { followingId: "desc" }],
      take: limit + 1,
      include: { following: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      ok: true,
      users: page.map((r) => publicUser(r.following)),
      nextCursor: hasMore ? page[page.length - 1].followingId : undefined,
    });
  })
);

usersRouter.post(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user!.id) throw badRequest("You cannot follow yourself");
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw notFound("User not found");
    if (await isBlocked(req.user!.id, targetId)) throw forbidden("You cannot follow this user");
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.user!.id, followingId: targetId } },
      create: { followerId: req.user!.id, followingId: targetId },
      update: {},
    });
    await createNotification({
      userId: targetId,
      actorId: req.user!.id,
      type: "follow",
      message: `${req.user!.username} started following you`,
    });
    res.json({ ok: true, isFollowing: true });
  })
);

usersRouter.delete(
  "/:id/follow",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.follow
      .delete({ where: { followerId_followingId: { followerId: req.user!.id, followingId: req.params.id } } })
      .catch(() => undefined);
    res.json({ ok: true, isFollowing: false });
  })
);

usersRouter.post(
  "/:id/block",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user!.id) throw badRequest("You cannot block yourself");
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw notFound("User not found");
    await prisma.$transaction([
      prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: targetId } },
        create: { blockerId: req.user!.id, blockedId: targetId },
        update: {},
      }),
      // Blocking also removes follows in both directions.
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: req.user!.id, followingId: targetId },
            { followerId: targetId, followingId: req.user!.id },
          ],
        },
      }),
    ]);
    await logAudit({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "user.block",
      targetType: "user",
      targetId,
    });
    res.json({ ok: true, isBlocked: true });
  })
);

usersRouter.delete(
  "/:id/block",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.block
      .delete({ where: { blockerId_blockedId: { blockerId: req.user!.id, blockedId: req.params.id } } })
      .catch(() => undefined);
    res.json({ ok: true, isBlocked: false });
  })
);

usersRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({ reason: z.string().min(1).max(200), details: z.string().max(1000).optional() }),
      req.body
    );
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound("User not found");
    if (target.id === req.user!.id) throw badRequest("You cannot report yourself");
    const report = await prisma.report.create({
      data: {
        reporterId: req.user!.id,
        targetType: "user",
        targetId: target.id,
        reason: body.reason,
        details: body.details,
      },
    });
    res.status(201).json({ ok: true, report: { id: report.id, status: report.status } });
  })
);
