import type { Request, Response, Router as ExpressRouter } from "express";
import { Router } from "express";
import { z } from "zod";
import type { AuthConfig } from "@cryptoai/config";
import { generateToken, hashPassword, hashToken, verifyPassword } from "@cryptoai/database";
import type { InMemoryRateLimiter } from "./rateLimiter.js";
import type { AuthStore } from "./types.js";
import { parseSessionCookie, requireAuth } from "./middleware.js";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

const COOKIE_NAME = "session";

function buildCookieHeader(value: string, options: CookieOptions): string {
  let cookie = `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/`;
  if (options.secure) cookie += "; Secure";
  if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`;
  return cookie;
}

interface CookieOptions {
  secure: boolean;
  maxAge?: number;
}

function isCsrfAllowed(req: Request, appOrigin: string): boolean {
  const origin = req.headers["origin"];
  if (!origin) return true; // curl / server-to-server: no browser, allow
  return origin === appOrigin;
}

function getIp(req: Request): string {
  return req.socket.remoteAddress ?? "";
}

export function createAuthRouter(
  store: AuthStore,
  limiter: InMemoryRateLimiter,
  config: AuthConfig
): ExpressRouter {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Pre-warm a dummy hash for timing-safe comparison when user not found
  const dummyHashPromise: Promise<string> = hashPassword(
    "_timing_safe_dummy_password_placeholder_00"
  );

  router.post("/login", async (req: Request, res: Response): Promise<void> => {
    if (!isCsrfAllowed(req, config.appOrigin)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const ip = getIp(req);
    const rateLimitKey = ip || "unknown";
    const { allowed } = limiter.check(rateLimitKey);

    if (!allowed) {
      await store.audit({
        event: "LOGIN_RATE_LIMITED",
        username: typeof req.body?.username === "string" ? req.body.username : undefined,
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(429).json({ error: "Too many login attempts. Try again later." });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { username, password } = parsed.data;
    const user = await store.findUserByUsername(username);

    if (!user) {
      // Constant-time dummy verification to prevent user enumeration via timing
      await verifyPassword(password, await dummyHashPromise);
      void store.audit({
        event: "LOGIN_FAILURE_USER_NOT_FOUND",
        username,
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.role !== "OWNER" || !user.passwordHash) {
      await store.audit({
        event: user.role !== "OWNER" ? "LOGIN_FAILURE_NOT_OWNER" : "LOGIN_FAILURE_NO_PASSWORD",
        username,
        userId: user.id,
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await store.audit({
        event: "LOGIN_FAILURE_WRONG_PASSWORD",
        username,
        userId: user.id,
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Successful login — reset rate limit for this IP
    limiter.reset(rateLimitKey);

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
    const session = await store.createSession(user.id, tokenHash, expiresAt);

    await store.audit({
      event: "LOGIN_SUCCESS",
      username,
      userId: user.id,
      sessionId: session.id,
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
    });

    const cookieHeader = buildCookieHeader(token, {
      secure: config.sessionCookieSecure,
      maxAge: config.sessionTtlSeconds,
    });
    res.setHeader("Set-Cookie", cookieHeader);
    res.json({ ok: true });
  });

  router.post("/logout", async (req: Request, res: Response): Promise<void> => {
    if (!isCsrfAllowed(req, config.appOrigin)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const token = parseSessionCookie(req.headers.cookie);
    if (token) {
      const tokenHash = hashToken(token);
      const session = await store.findSessionByHash(tokenHash);
      if (session && !session.revokedAt) {
        await store.revokeSession(tokenHash);
        await store.audit({
          event: "LOGOUT",
          userId: session.userId,
          sessionId: session.id,
          ipAddress: getIp(req),
          userAgent: req.headers["user-agent"],
        });
      }
    }

    // Clear cookie
    const clearCookie = buildCookieHeader("", {
      secure: config.sessionCookieSecure,
      maxAge: 0,
    });
    res.setHeader("Set-Cookie", clearCookie);
    res.json({ ok: true });
  });

  router.get("/me", requireAuth(store), (req: Request, res: Response) => {
    const session = req.sessionData;
    res.json({ userId: session?.userId, sessionId: session?.id });
  });

  return router;
}
