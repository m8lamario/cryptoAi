import type { NextFunction, Request, Response } from "express";
import { hashToken } from "@cryptoai/database";
import type { AuthStore } from "./types.js";

export function requireAuth(store: AuthStore) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = parseSessionCookie(req.headers.cookie);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const tokenHash = hashToken(token);
    const session = await store.findSessionByHash(tokenHash);

    if (!session) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }

    if (session.revokedAt) {
      await store.audit({
        event: "SESSION_REVOKED_ACCESS_ATTEMPT",
        userId: session.userId,
        sessionId: session.id,
        ipAddress: getIp(req),
      });
      res.status(401).json({ error: "Session revoked" });
      return;
    }

    if (session.expiresAt < new Date()) {
      await store.audit({
        event: "SESSION_EXPIRED",
        userId: session.userId,
        sessionId: session.id,
        ipAddress: getIp(req),
      });
      res.status(401).json({ error: "Session expired" });
      return;
    }

    req.sessionData = session;
    next();
  };
}

export function parseSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name === "session") {
      return part.slice(eqIdx + 1).trim() || undefined;
    }
  }
  return undefined;
}

function getIp(req: Request): string {
  return req.socket.remoteAddress ?? "";
}
