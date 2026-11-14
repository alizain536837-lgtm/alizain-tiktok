import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../lib/errors";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Multer errors (file too large, invalid type, ...)
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ ok: false, error: "File is too large" });
      return;
    }
    if (code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({ ok: false, error: "Unexpected upload field" });
      return;
    }
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }
  if (err instanceof Error) {
    // Multer fileFilter rejections surface as plain Errors.
    if (err.message.startsWith("Unsupported")) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      res.status(401).json({ ok: false, error: "Invalid or expired token" });
      return;
    }
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal server error" });
    return;
  }
  res.status(500).json({ ok: false, error: "Internal server error" });
}
