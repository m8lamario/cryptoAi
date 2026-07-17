import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Express } from "express";
import { hashPassword, hashToken, verifyPassword } from "@cryptoai/database";
import type { AuthConfig } from "@cryptoai/config";
import { createApp } from "../src/app.js";
import { InMemoryAuthStore } from "../src/auth/inMemorySessionStore.js";
import { InMemoryRateLimiter } from "../src/auth/rateLimiter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testAuthConfig: AuthConfig = {
  appOrigin: "http://localhost:3000",
  apiBaseUrl: "http://localhost:4000",
  sessionTtlSeconds: 3600,
  sessionCookieSecure: false,
  loginRateLimitMaxAttempts: 5,
  loginRateLimitWindowSeconds: 60,
};

const OWNER_USERNAME = "owner";
const OWNER_PASSWORD = "correct-horse-battery-staple";

async function buildApp(configOverride?: Partial<AuthConfig>) {
  const store = new InMemoryAuthStore();
  const passwordHash = await hashPassword(OWNER_PASSWORD);
  store.addUser({
    id: "user-1",
    username: OWNER_USERNAME,
    passwordHash,
    role: "OWNER",
  });

  const authConfig = { ...testAuthConfig, ...configOverride };
  const rateLimiter = new InMemoryRateLimiter(
    authConfig.loginRateLimitMaxAttempts,
    authConfig.loginRateLimitWindowSeconds * 1000
  );

  const app = createApp({ authStore: store, rateLimiter, authConfig });
  return { app, store };
}

function extractCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"];
  const list: string[] = Array.isArray(raw) ? raw : raw != null ? [raw as string] : [];
  for (const c of list) {
    if (c.startsWith(`${name}=`)) {
      return c.split(";")[0];
    }
  }
  return undefined;
}

async function loginAndGetCookie(
  app: Express,
  username = OWNER_USERNAME,
  password = OWNER_PASSWORD
): Promise<string | undefined> {
  const res = await request(app).post("/auth/login").send({ username, password });
  return extractCookie(res, "session");
}

function getCookieFlags(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const list: string[] = Array.isArray(raw) ? raw : raw != null ? [raw as string] : [];
  return list[0] ?? "";
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
describe("POST /auth/login", () => {
  it("returns 200 and sets session cookie on valid credentials", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });

    const cookie = extractCookie(res, "session");
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^session=[0-9a-f]{64}$/);
  });

  it("cookie has HttpOnly, SameSite=Lax and Path=/ flags", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    const flags = getCookieFlags(res);
    expect(flags).toMatch(/HttpOnly/i);
    expect(flags).toMatch(/SameSite=Lax/i);
    expect(flags).toMatch(/Path=\//i);
  });

  it("Secure flag absent when sessionCookieSecure=false", async () => {
    const { app } = await buildApp({ sessionCookieSecure: false });
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    expect(getCookieFlags(res)).not.toMatch(/;\s*Secure/i);
  });

  it("Secure flag present when sessionCookieSecure=true", async () => {
    const { app } = await buildApp({ sessionCookieSecure: true });
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    expect(getCookieFlags(res)).toMatch(/;\s*Secure/i);
  });

  it("returns 401 on wrong password", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: "wrong-password-xyz" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Invalid credentials" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("returns 401 when user does not exist", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "nonexistent", password: OWNER_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Invalid credentials" });
  });

  it("returns 400 on missing fields", async () => {
    const { app } = await buildApp();
    const res = await request(app).post("/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("rejects login from disallowed browser Origin (CSRF)", async () => {
    const { app } = await buildApp({ appOrigin: "http://localhost:3000" });
    const res = await request(app)
      .post("/auth/login")
      .set("Origin", "http://evil.example.com")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    expect(res.status).toBe(403);
  });

  it("allows login without Origin header (curl/server-to-server)", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
describe("POST /auth/logout", () => {
  it("revokes session and clears cookie", async () => {
    const { app } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    expect(cookie).toBeDefined();

    const logoutRes = await request(app).post("/auth/logout").set("Cookie", cookie!);

    expect(logoutRes.status).toBe(200);
    const clearCookie = extractCookie(logoutRes, "session");
    expect(clearCookie).toBe("session=");
  });

  it("revoked session cannot access /auth/me", async () => {
    const { app } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    await request(app).post("/auth/logout").set("Cookie", cookie!);

    const meRes = await request(app).get("/auth/me").set("Cookie", cookie!);
    expect(meRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
describe("GET /auth/me", () => {
  it("returns 200 with userId for valid session", async () => {
    const { app } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    expect(cookie).toBeDefined();

    const res = await request(app).get("/auth/me").set("Cookie", cookie!);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "user-1" });
  });

  it("returns 401 with no cookie", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/auth/me").set("Cookie", "session=deadbeef");
    expect(res.status).toBe(401);
  });

  it("returns 401 when session is expired", async () => {
    const { app, store } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    expect(cookie).toBeDefined();

    // Backdate expiry in the in-memory store
    const token = cookie!.replace("session=", "");
    const tokenHash = hashToken(token);
    const session = await store.findSessionByHash(tokenHash);
    expect(session).not.toBeNull();
    session!.expiresAt = new Date(Date.now() - 1000);

    const res = await request(app).get("/auth/me").set("Cookie", cookie!);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /private/status (protected endpoint)
// ---------------------------------------------------------------------------
describe("GET /private/status", () => {
  it("returns 200 with valid session", async () => {
    const { app } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    expect(cookie).toBeDefined();

    const res = await request(app).get("/private/status").set("Cookie", cookie!);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("returns 401 without session", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/private/status");
    expect(res.status).toBe(401);
  });

  it("returns 401 after logout", async () => {
    const { app } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    await request(app).post("/auth/logout").set("Cookie", cookie!);

    const res = await request(app).get("/private/status").set("Cookie", cookie!);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe("Login rate limiting", () => {
  it("returns 429 after exceeding max attempts", async () => {
    const { app } = await buildApp({ loginRateLimitMaxAttempts: 3 });

    for (let i = 0; i < 3; i++) {
      await request(app).post("/auth/login").send({ username: OWNER_USERNAME, password: "wrong" });
    }

    const res = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: "wrong" });

    expect(res.status).toBe(429);
  });

  it("resets rate limit on successful login", async () => {
    const { app } = await buildApp({ loginRateLimitMaxAttempts: 3 });

    for (let i = 0; i < 2; i++) {
      await request(app).post("/auth/login").send({ username: OWNER_USERNAME, password: "wrong" });
    }

    // Successful login resets counter
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });
    expect(loginRes.status).toBe(200);

    // Next wrong attempt should return 401 (not 429)
    const afterRes = await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: "wrong" });
    expect(afterRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// No public registration
// ---------------------------------------------------------------------------
describe("No public registration", () => {
  it("POST /auth/register returns 404", async () => {
    const { app } = await buildApp();
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "attacker", password: "password123" });
    expect(res.status).toBe(404);
  });
});

describe("Single-owner constraint", () => {
  it("rejects adding a second owner", () => {
    const store = new InMemoryAuthStore();
    store.addUser({
      id: "user-1",
      username: OWNER_USERNAME,
      passwordHash: "stored-hash",
      role: "OWNER",
    });

    expect(() =>
      store.addUser({
        id: "user-2",
        username: "second-owner",
        passwordHash: "stored-hash",
        role: "OWNER",
      })
    ).toThrow("Only one owner account is allowed");
  });
});

// ---------------------------------------------------------------------------
// Audit logging (events must not contain secrets)
// ---------------------------------------------------------------------------
describe("Audit logging", () => {
  it("records LOGIN_SUCCESS without password", async () => {
    const { app, store } = await buildApp();
    await request(app)
      .post("/auth/login")
      .send({ username: OWNER_USERNAME, password: OWNER_PASSWORD });

    const log = store.getAuditLog();
    const success = log.find((e) => e.event === "LOGIN_SUCCESS");
    expect(success).toBeDefined();
    expect(success?.username).toBe(OWNER_USERNAME);
    expect(JSON.stringify(success)).not.toContain(OWNER_PASSWORD);
  });

  it("records LOGIN_FAILURE_USER_NOT_FOUND", async () => {
    const { app, store } = await buildApp();
    await request(app)
      .post("/auth/login")
      .send({ username: "ghost", password: "x".repeat(8) });

    const log = store.getAuditLog();
    expect(log.some((e) => e.event === "LOGIN_FAILURE_USER_NOT_FOUND")).toBe(true);
  });

  it("records LOGIN_RATE_LIMITED", async () => {
    const { app, store } = await buildApp({ loginRateLimitMaxAttempts: 2 });
    for (let i = 0; i < 3; i++) {
      await request(app).post("/auth/login").send({ username: OWNER_USERNAME, password: "bad" });
    }

    const log = store.getAuditLog();
    expect(log.some((e) => e.event === "LOGIN_RATE_LIMITED")).toBe(true);
  });

  it("records LOGOUT event", async () => {
    const { app, store } = await buildApp();
    const cookie = await loginAndGetCookie(app);
    await request(app).post("/auth/logout").set("Cookie", cookie!);

    const log = store.getAuditLog();
    expect(log.some((e) => e.event === "LOGOUT")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /health remains public (no auth required)
// ---------------------------------------------------------------------------
describe("GET /health remains public", () => {
  it("returns 200 without session", async () => {
    const { app } = await buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// Password hash/verify utilities
// ---------------------------------------------------------------------------
describe("password utilities", () => {
  it("hashPassword produces a valid scrypt string", async () => {
    const hash = await hashPassword("password1");
    expect(hash).toMatch(/^scrypt:16384:8:1:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hash = await hashPassword("mysecretpassword");
    expect(await verifyPassword("mysecretpassword", hash)).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hash = await hashPassword("correctpassword");
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("hashPassword throws for too-short password", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("two hashes of same password are different (random salt)", async () => {
    const h1 = await hashPassword("samepassword");
    const h2 = await hashPassword("samepassword");
    expect(h1).not.toBe(h2);
  });
});
