// Extend Express Request to carry authenticated session data
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionData?: SessionData;
    }
  }
}

export interface SessionData {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface UserData {
  id: string;
  username: string;
  passwordHash: string | null;
  role: string;
}

export interface AuthAuditInput {
  event: string;
  username?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthStore {
  findUserByUsername(username: string): Promise<UserData | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionData>;
  findSessionByHash(tokenHash: string): Promise<SessionData | null>;
  revokeSession(tokenHash: string): Promise<void>;
  audit(input: AuthAuditInput): Promise<void>;
}
