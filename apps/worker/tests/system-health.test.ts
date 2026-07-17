import { describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { createSystemHealthQueue, createSystemHealthWorker } from "../src/queues/system-health.js";

describe("system-health queue", () => {
  it("creates a queue without throwing", () => {
    expect(() => createSystemHealthQueue("redis://localhost:6379")).not.toThrow();
  });

  it("creates a worker without throwing", () => {
    expect(() => createSystemHealthWorker("redis://localhost:6379")).not.toThrow();
  });

  it("queue.add returns a job-like object", async () => {
    const queue = createSystemHealthQueue("redis://localhost:6379");
    const job = await queue.add("ping", { checkType: "ping" });
    expect(job).toBeDefined();
  });
});
