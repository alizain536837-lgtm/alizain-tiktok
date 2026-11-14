import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { asyncHandler, parseBody } from "../lib/validate";
import { requireAuth } from "../middleware/auth";

export const liveRouter = Router();

const NO_PROVIDER_REASON =
  "No live streaming provider is configured. Configure Mux or LiveKit in Admin → Live Streaming.";

async function liveProvider(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "liveProvider" } });
  return (setting?.value || process.env.LIVE_PROVIDER || "none").toLowerCase();
}

liveRouter.get(
  "/availability",
  asyncHandler(async (_req, res) => {
    const provider = await liveProvider();
    if (provider === "none" || !provider) {
      res.json({ ok: true, available: false, reason: NO_PROVIDER_REASON });
      return;
    }
    res.json({ ok: true, available: true, provider });
  })
);

liveRouter.post(
  "/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = await liveProvider();
    if (provider === "none" || !provider) {
      // Honest 503: there is no streaming provider behind this endpoint.
      res.status(503).json({ ok: false, error: "Live streaming is unavailable: no provider configured." });
      return;
    }
    // A provider is configured in settings but no provider integration is
    // implemented in this build — do not pretend a stream started.
    res.status(503).json({
      ok: false,
      error: `Live streaming provider "${provider}" is configured but not integrated in this build.`,
    });
  })
);

liveRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const streams = await prisma.liveStream.findMany({
      where: { status: "live" },
      orderBy: { createdAt: "desc" },
      include: { host: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    res.json({ ok: true, streams });
  })
);

liveRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({ reason: z.string().min(1).max(200), details: z.string().max(1000).optional() }),
      req.body
    );
    const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
    if (!stream) throw notFound("Live stream not found");
    const report = await prisma.report.create({
      data: { reporterId: req.user!.id, targetType: "live", targetId: stream.id, reason: body.reason, details: body.details },
    });
    res.status(201).json({ ok: true, report: { id: report.id, status: report.status } });
  })
);
