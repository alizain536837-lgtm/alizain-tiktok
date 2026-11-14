import express from "express";
import type { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import "dotenv/config";

import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { videosRouter } from "./routes/videos";
import { hashtagsRouter } from "./routes/hashtags";
import { soundsRouter } from "./routes/sounds";
import { conversationsRouter } from "./routes/conversations";
import { notificationsRouter } from "./routes/notifications";
import { creatorRouter } from "./routes/creator";
import { liveRouter } from "./routes/live";
import { adminRouter } from "./routes/admin";
import { errorHandler, notFound } from "./middleware/error";
import { configureCloudinary, ensureUploadDirs, uploadDir } from "./lib/upload";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins.length ? origins : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Global rate limit: 300 requests/minute per IP.
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ ok: false, error: "Too many requests, please slow down" }),
  });
  app.use(globalLimiter);

  // Auth rate limit: 40 requests/15min per IP on auth endpoints.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ ok: false, error: "Too many auth attempts, try again later" }),
  });
  app.use("/api/auth", authLimiter);

  // Static files: local uploads + built-in sound loops.
  ensureUploadDirs();
  app.use("/uploads", express.static(uploadDir()));
  app.use("/sounds", express.static(path.resolve(__dirname, "..", "assets", "sounds")));

  // Health
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "alizain-tiktok-backend" });
  });

  // API routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/videos", videosRouter);
  app.use("/api/hashtags", hashtagsRouter);
  app.use("/api/sounds", soundsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/creator", creatorRouter);
  app.use("/api/live", liveRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  configureCloudinary();
  return app;
}

/**
 * The Express app. Exported (no listen) so the Netlify Function can import
 * it directly. Local dev uses src/index.ts, which listens.
 */
export const app = createApp();
