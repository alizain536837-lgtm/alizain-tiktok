import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/validate";
import { requireAuth } from "../middleware/auth";

export const creatorRouter = Router();

creatorRouter.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const myVideos = await prisma.video.findMany({
      where: { authorId: userId, status: "ready" },
      select: { id: true, caption: true, views: true },
      orderBy: { views: "desc" },
      take: 5,
    });
    const [totalViewsAgg, totalLikes, followers, videosCount] = await Promise.all([
      prisma.video.aggregate({ where: { authorId: userId, status: "ready" }, _sum: { views: true } }),
      prisma.like.count({ where: { video: { authorId: userId, status: "ready" } } }),
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.video.count({ where: { authorId: userId, status: "ready" } }),
    ]);
    const topVideos = [];
    for (const v of myVideos) {
      const likes = await prisma.like.count({ where: { videoId: v.id } });
      topVideos.push({ id: v.id, caption: v.caption, views: v.views, likes });
    }
    // Recent activity: the creator's own latest notifications (likes, follows, comments).
    const recentActivity = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    res.json({
      ok: true,
      stats: {
        totalViews: totalViewsAgg._sum.views ?? 0,
        totalLikes,
        followers,
        videosCount,
        topVideos,
        recentActivity,
      },
    });
  })
);
