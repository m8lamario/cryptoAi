import { randomBytes } from "node:crypto";
import type { AuthAuditInput, AuthStore, SessionData, UserData } from "./types.js";

export class InMemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, UserData>();
  private readonly sessions = new Map<string, SessionData>();
  private readonly auditLog: AuthAuditInput[] = [];

  addUser(user: UserData): void {
    if (user.role === "OWNER") {
      const ownerExists = [...this.users.values()].some((existing) => existing.role === "OWNER");
      if (ownerExists) {
        throw new Error("Only one owner account is allowed");
      }
    }
    this.users.set(user.username, user);
  }

  async findUserByUsername(username: string): Promise<UserData | null> {
    return this.users.get(username) ?? null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionData> {
    const session: SessionData = {
      id: randomBytes(8).toString("hex"),
      tokenHash,
      userId,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    };
    this.sessions.set(tokenHash, session);
    return session;
  }

  async findSessionByHash(tokenHash: string): Promise<SessionData | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) {
      session.revokedAt = new Date();
    }
  }

  async audit(input: AuthAuditInput): Promise<void> {
    this.auditLog.push({ ...input });
  }

  getAuditLog(): AuthAuditInput[] {
    return [...this.auditLog];
  }

  clear(): void {
    this.users.clear();
    this.sessions.clear();
    this.auditLog.length = 0;
  }
}
