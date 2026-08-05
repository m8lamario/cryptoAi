import { createHash, randomUUID } from "node:crypto";

export const WORKFLOW_PHASES = ["SNAPSHOT", "SIGNAL", "AI_ANALYSIS", "PROPOSAL", "DECISION_GATE", "RISK", "EXECUTION", "OUTCOME"] as const;
export type WorkflowPhaseName = (typeof WORKFLOW_PHASES)[number];
export type WorkflowMode = "LIVE" | "REPLAY" | "BACKTEST";
export type ExecutionPolicy = "PAPER_ALLOWED" | "NO_EXECUTION";

export interface StartWorkflowCommand {
  workflowKey: string;
  correlationId?: string;
  mode: WorkflowMode;
  asset: string;
  asOf: string;
  trigger: "SCANNER" | "MANUAL" | "REPLAY" | "BACKTEST";
  sourceWorkflowRunId?: string;
  executionPolicy?: ExecutionPolicy;
  bullJobId?: string;
}

export interface SnapshotBundle {
  schemaVersion: "workflow-snapshot-v1";
  asOf: string;
  asset: string;
  marketSnapshotId: string;
  candleIds: string[];
  externalSnapshotIds: string[];
  configurationSnapshotIds: string[];
  contentHash: string;
}

export function canonicalHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return Object.fromEntries(Object.entries(nested as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    return nested;
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function createWorkflowCommand(input: Omit<StartWorkflowCommand, "correlationId" | "executionPolicy">): StartWorkflowCommand {
  return { ...input, correlationId: randomUUID(), executionPolicy: input.mode === "LIVE" ? "PAPER_ALLOWED" : "NO_EXECUTION" };
}

