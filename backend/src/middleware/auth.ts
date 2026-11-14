import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { verifyAccessToken } from "../lib/auth";
import { forbidden, unauthorized } from "../lib/errors";
import { prisma } from "../lib/prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

async function loadUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized("User not found");
  if (user.status === "suspended") throw forbidden("Account suspended");
  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) throw unauthorized();
    const payload = verifyAccessToken(token);
    req.user = await loadUser(payload.sub);
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        req.user = await loadUser(payload.sub);
      } catch {
        // Invalid/expired token on an optional route: treat as anonymous.
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden("Admin access required"));
    next();
  };
}
