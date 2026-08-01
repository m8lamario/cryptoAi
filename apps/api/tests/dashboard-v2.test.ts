import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("Dashboard 2.0 private endpoints", () => {
  it.each(["/equity-history", "/timeline", "/agent-status"])("protects GET %s", async (path) => {
    const response = await request(createApp()).get(path);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Authentication required" });
  });
});
