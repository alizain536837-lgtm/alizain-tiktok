import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// ffprobe-static ships no types; the package exports { path }.
const ffprobe = require("ffprobe-static") as { path: string };

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

export function ensureUploadDirs(): void {
  for (const sub of ["videos", "thumbnails", "sounds", "avatars"]) {
    fs.mkdirSync(path.join(uploadDir(), sub), { recursive: true });
  }
}

/** Public base URL for locally stored files (empty string = relative paths). */
export function publicBase(): string {
  return (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function localUrl(relativePath: string): string {
  const rel = "/" + relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return publicBase() ? publicBase() + rel : rel;
}

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function configureCloudinary(): void {
  if (cloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
];

function randomName(ext: string): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function storageFor(subdir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(uploadDir(), subdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, randomName(path.extname(file.originalname).toLowerCase() || ".bin"));
    },
  });
}

function fileFilter(allowed: string[]) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  };
}

export const videoUpload = multer({
  storage: storageFor("videos"),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: fileFilter(VIDEO_MIMES),
});

export const thumbnailUpload = multer({
  storage: storageFor("thumbnails"),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE_MIMES),
});

export const soundUpload = multer({
  storage: storageFor("sounds"),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: fileFilter(AUDIO_MIMES),
});

/** Combined fields parser for POST /api/videos/upload. */
export const videoUploadFields = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      const sub = file.fieldname === "thumbnail" ? "thumbnails" : "videos";
      const dir = path.join(uploadDir(), sub);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, randomName(path.extname(file.originalname).toLowerCase() || ".bin"));
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`Unsupported thumbnail type: ${file.mimetype}`));
    } else if (file.fieldname === "video") {
      if (VIDEO_MIMES.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`Unsupported video type: ${file.mimetype}`));
    } else {
      cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
  },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

/** Video duration in seconds via the ffprobe-static binary. */
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobe.path, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${err || `exit ${code}`}`));
      try {
        const parsed = JSON.parse(out) as { format?: { duration?: string } };
        const dur = parseFloat(parsed.format?.duration ?? "");
        if (!Number.isFinite(dur)) return reject(new Error("ffprobe: no duration found"));
        resolve(dur);
      } catch (e) {
        reject(new Error(`ffprobe: could not parse output: ${String(e)}`));
      }
    });
  });
}

/** Generate a JPEG thumbnail from a video file (system ffmpeg, 1s mark). */
export function generateThumbnail(videoPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-v", "error", "-ss", "1", "-i", videoPath, "-vframes", "1", "-vf", "scale=540:-1", outPath],
      { timeout: 30_000 },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/** Upload a local file to Cloudinary (only called when CLOUDINARY_* are set). */
export function uploadToCloudinary(
  localPath: string,
  opts: { resourceType: "video" | "image" | "auto"; folder: string }
): Promise<{ secureUrl: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      localPath,
      { resource_type: opts.resourceType, folder: opts.folder },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      }
    );
  });
}

export function deleteLocalFile(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best effort
  }
}

/**
 * Resolve a stored filePath (relative to the backend root, e.g.
 * "assets/sounds/x.wav" or "uploads/sounds/y.mp3") to an absolute path.
 * Resolved from this file's location, not process.cwd(), so it also works
 * when the app is imported by a Netlify Function.
 */
export function resolveStoredPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  const fromBackendRoot = path.resolve(__dirname, "../..", filePath);
  if (fs.existsSync(fromBackendRoot)) return fromBackendRoot;
  return path.resolve(filePath);
}
