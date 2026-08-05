import { describe, expect, it } from "vitest";
import { canonicalHash, createWorkflowCommand } from "./contracts.js";

describe("M8 workflow contracts", () => {
  it("hashes equivalent objects deterministically", () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
  });
  it("prevents execution in replay workflows", () => {
    const command = createWorkflowCommand({ workflowKey: "replay-1", mode: "REPLAY", asset: "BTCUSDT", asOf: "2026-08-05T00:00:00.000Z", trigger: "REPLAY" });
    expect(command.executionPolicy).toBe("NO_EXECUTION");
  });
});

