import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function randomDigits(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(crypto.randomInt(0, 10));
  return out;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

export function signAccessToken(user: Pick<User, "id" | "username" | "role">): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role } as AccessTokenPayload,
    secret,
    { expiresIn: "15m" }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret) as AccessTokenPayload;
}

/** Opaque refresh token: returned to the client once, stored SHA-256 hashed. */
export function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomToken(32);
  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };
}
