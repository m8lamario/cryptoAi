import { prisma } from "@cryptoai/database";
import type { AuthAuditInput, AuthStore, SessionData, UserData } from "./types.js";

export class PrismaAuthStore implements AuthStore {
  async findUserByUsername(username: string): Promise<UserData | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, passwordHash: true, role: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role,
    };
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionData> {
    const session = await prisma.session.create({
      data: { userId, tokenHash, expiresAt },
    });
    return {
      id: session.id,
      tokenHash: session.tokenHash,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    };
  }

  async findSessionByHash(tokenHash: string): Promise<SessionData | null> {
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session) return null;
    return {
      id: session.id,
      tokenHash: session.tokenHash,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await prisma.session.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async audit(input: AuthAuditInput): Promise<void> {
    await prisma.authAuditEvent.create({
      data: {
        event: input.event,
        username: input.username,
        userId: input.userId,
        sessionId: input.sessionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as Parameters<
          typeof prisma.authAuditEvent.create
        >[0]["data"]["metadata"],
      },
    });
  }
}
