import { prisma } from "./prisma";

/** Write an audit-log row for an admin (or moderation) action. Never throws. */
export async function logAudit(opts: {
  actorId?: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actorId ?? null,
        actorRole: opts.actorRole,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        details: opts.details ?? null,
      },
    });
  } catch {
    // Audit logging must never break the action itself.
  }
}
