import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  hashPassword,
  newRefreshToken,
  randomDigits,
  sha256,
  signAccessToken,
  verifyPassword,
} from "../lib/auth";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { asyncHandler, parseBody } from "../lib/validate";
import { publicUser } from "../lib/serializers";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-z0-9_.]+$/, "Username may only contain lowercase letters, numbers, _ and .")
  .transform((v) => v.toLowerCase());

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email("Invalid email").transform((v) => v.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required").max(50),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

async function issueTokens(userId: string) {
  const refresh = newRefreshToken();
  await prisma.session.create({
    data: { userId, refreshTokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });
  return refresh.token;
}

async function registrationOpen(): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key: "registrationOpen" } });
  return setting ? setting.value !== "false" : true;
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    if (!(await registrationOpen())) throw forbidden("Registration is closed");
    const existingUsername = await prisma.user.findUnique({ where: { username: body.username } });
    if (existingUsername) throw conflict("Username is already taken");
    const existingEmail = await prisma.user.findUnique({ where: { email: body.email } });
    if (existingEmail) throw conflict("Email is already registered");
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
      },
    });
    const refreshToken = await issueTokens(user.id);
    res.status(201).json({
      ok: true,
      user: publicUser(user),
      accessToken: signAccessToken(user),
      refreshToken,
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const identifier = body.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!user) throw unauthorized("Invalid credentials");
    if (user.status === "suspended") throw forbidden("Account suspended");
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized("Invalid credentials");
    }
    const refreshToken = await issueTokens(user.id);
    res.json({ ok: true, user: publicUser(user), accessToken: signAccessToken(user), refreshToken });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = parseBody(z.object({ refreshToken: z.string().min(1) }), req.body);
    const session = await prisma.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session) throw unauthorized("Invalid refresh token");
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw unauthorized("Refresh token expired");
    }
    if (session.user.status === "suspended") throw forbidden("Account suspended");
    // Rotate: invalidate the old token, issue a new one.
    await prisma.session.delete({ where: { id: session.id } });
    const newToken = await issueTokens(session.userId);
    res.json({
      ok: true,
      accessToken: signAccessToken(session.user),
      refreshToken: newToken,
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = parseBody(z.object({ refreshToken: z.string().min(1) }), req.body);
    await prisma.session
      .delete({ where: { refreshTokenHash: sha256(refreshToken) } })
      .catch(() => undefined);
    res.json({ ok: true });
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = parseBody(
      z.object({ email: z.string().email().transform((v) => v.toLowerCase()) }),
      req.body
    );
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether the email exists.
      res.json({ ok: true, resetCode: null });
      return;
    }
    const code = randomDigits(6);
    await prisma.passwordReset.updateMany({
      where: { email, used: false },
      data: { used: true },
    });
    await prisma.passwordReset.create({
      data: {
        email,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    // NOTE: No email provider is configured for this app, so the reset code
    // is returned in the response (and shown in-app) instead of being emailed.
    // When an email provider is added, stop returning the code here.
    res.json({ ok: true, resetCode: code });
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        email: z.string().email().transform((v) => v.toLowerCase()),
        code: z.string().length(6),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
      req.body
    );
    const reset = await prisma.passwordReset.findFirst({
      where: { email: body.email, used: false },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) throw badRequest("Invalid or expired reset code");
    if (reset.expiresAt < new Date()) throw badRequest("Reset code has expired");
    if (sha256(body.code) !== reset.codeHash) throw badRequest("Invalid reset code");
    await prisma.$transaction([
      prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
      prisma.user.updateMany({
        where: { email: body.email },
        data: { passwordHash: await hashPassword(body.newPassword) },
      }),
    ]);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user) {
      // Log out everywhere after a password reset.
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw notFound("User not found");
    res.json({ ok: true, user: publicUser(req.user) });
  })
);
