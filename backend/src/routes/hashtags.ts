import { Router } from "express";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { asyncHandler, cursorPage, olderThan, pagination } from "../lib/validate";
import { serializeVideo } from "../lib/serializers";
import { optionalAuth } from "../middleware/auth";

export const hashtagsRouter = Router();

const videoInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  sound: { select: { id: true, title: true, artist: true } },
  hashtags: { select: { tag: true } },
  _count: { select: { likes: true, comments: true, savedBy: true } },
} as const;

hashtagsRouter.get(
  "/trending",
  asyncHandler(async (_req, res) => {
    const groups = await prisma.videoHashtag.groupBy({
      by: ["tag"],
      where: { video: { status: "ready" } },
      _count: { tag: true },
      orderBy: { _count: { tag: "desc" } },
      take: 20,
    });
    res.json({
      ok: true,
      hashtags: groups.map((g) => ({ tag: g.tag, videosCount: g._count.tag })),
    });
  })
);

hashtagsRouter.get(
  "/:tag/videos",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const tag = req.params.tag.replace(/^#/, "").toLowerCase();
    const exists = await prisma.hashtag.findUnique({ where: { tag } });
    if (!exists) throw notFound("Hashtag not found");
    const { limit, cursor } = pagination(req);
    const where: Record<string, unknown> = { tag, video: { status: "ready" } };
    if (cursor) {
      const cursorRow = await prisma.videoHashtag.findUnique({
        where: { videoId_tag: { videoId: cursor, tag } },
      });
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
    const rows = await prisma.videoHashtag.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { videoId: "desc" }],
      take: limit + 1,
      include: { video: { include: videoInclude } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const videos = page.map((r) => r.video);
    let likedIds = new Set<string>();
    let savedIds = new Set<string>();
    if (req.user) {
      const ids = videos.map((v) => v.id);
      likedIds = new Set((await prisma.like.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((l) => l.videoId));
      savedIds = new Set((await prisma.savedVideo.findMany({ where: { userId: req.user.id, videoId: { in: ids } }, select: { videoId: true } })).map((s) => s.videoId));
    }
    res.json({
      ok: true,
      tag,
      videos: videos.map((v) => serializeVideo(v, { likedIds, savedIds })),
      nextCursor: hasMore ? page[page.length - 1].videoId : undefined,
    });
  })
);
