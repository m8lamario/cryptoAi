import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/checks/postgres.js", () => ({
  checkPostgres: vi.fn(),
}));
vi.mock("../src/checks/redis.js", () => ({
  checkRedis: vi.fn(),
}));

const { checkPostgres } = await import("../src/checks/postgres.js");
const { checkRedis } = await import("../src/checks/redis.js");
const { createApp } = await import("../src/app.js");

describe("GET /ready", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 when all checks pass", async () => {
    vi.mocked(checkPostgres).mockResolvedValue(true);
    vi.mocked(checkRedis).mockResolvedValue(true);

    const app = createApp();
    const res = await request(app).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ready: true,
      checks: { postgres: "ok", redis: "ok" },
    });
  });

  it("returns 503 when postgres is unavailable", async () => {
    vi.mocked(checkPostgres).mockResolvedValue(false);
    vi.mocked(checkRedis).mockResolvedValue(true);

    const app = createApp();
    const res = await request(app).get("/ready");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      ready: false,
      checks: { postgres: "unavailable", redis: "ok" },
    });
  });

  it("returns 503 when redis is unavailable", async () => {
    vi.mocked(checkPostgres).mockResolvedValue(true);
    vi.mocked(checkRedis).mockResolvedValue(false);

    const app = createApp();
    const res = await request(app).get("/ready");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      ready: false,
      checks: { postgres: "ok", redis: "unavailable" },
    });
  });
});
