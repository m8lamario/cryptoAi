import { prisma } from "@cryptoai/database";
import { canonicalHash, type SnapshotBundle, type StartWorkflowCommand, WORKFLOW_PHASES } from "./contracts.js";
import { resolveSnapshotBundle } from "./snapshot-service.js";

export async function startOrResumeWorkflow(command: StartWorkflowCommand, configurationSnapshotIds: string[]) {
  const executionPolicy = command.executionPolicy ?? (command.mode === "LIVE" ? "PAPER_ALLOWED" : "NO_EXECUTION");
  if (command.mode !== "LIVE" && executionPolicy !== "NO_EXECUTION") throw new Error("Replay and backtest workflows cannot execute orders");
  const asOf = new Date(command.asOf);
  const existing = await prisma.workflowRun.findUnique({ where: { workflowKey: command.workflowKey }, include: { phases: true } });
  if (existing) return existing;
  const snapshotBundle = await resolveSnapshotBundle(command.asset, asOf, configurationSnapshotIds);
  return prisma.$transaction(async (tx) => {
    const run = await tx.workflowRun.create({ data: { workflowKey: command.workflowKey, correlationId: command.correlationId ?? command.workflowKey, parentRunId: command.sourceWorkflowRunId, mode: command.mode, trigger: command.trigger, asset: command.asset, asOf, status: "PENDING", executionPolicy, snapshotBundle: snapshotBundle as never, snapshotHash: snapshotBundle.contentHash, configurationSnapshotIds, bullJobId: command.bullJobId } });
    await tx.workflowPhase.createMany({ data: WORKFLOW_PHASES.map((name, sequence) => ({ workflowRunId: run.id, name, sequence, status: "PENDING", inputHash: canonicalHash({ workflowKey: command.workflowKey, name, snapshotHash: snapshotBundle.contentHash }) })) });
    return run;
  });
}

export async function completeWorkflowPhase(workflowRunId: string, phaseName: (typeof WORKFLOW_PHASES)[number], output: unknown, status: "SUCCEEDED" | "SKIPPED" = "SUCCEEDED"): Promise<void> {
  await prisma.workflowPhase.update({ where: { workflowRunId_name: { workflowRunId, name: phaseName } }, data: { status, outputJson: output as never, outputHash: canonicalHash(output), endedAt: new Date(), attempt: { increment: 1 } } });
}

export async function registerWorkflowArtifact(workflowRunId: string, phaseName: string, artifactType: string, entityType: string, entityId: string, content: unknown, role?: string): Promise<void> {
  await prisma.workflowArtifact.upsert({ where: { workflowRunId_phaseName_artifactType_entityId: { workflowRunId, phaseName, artifactType, entityId } }, update: {}, create: { workflowRunId, phaseName, artifactType, entityType, entityId, contentHash: canonicalHash(content), role } });
}

export async function createReplayCommand(sourceWorkflowKey: string, replayKey: string): Promise<StartWorkflowCommand> {
  const source = await prisma.workflowRun.findUnique({ where: { workflowKey: sourceWorkflowKey } });
  if (!source) throw new Error("Source workflow not found");
  const bundle = source.snapshotBundle as unknown as SnapshotBundle;
  if (canonicalHash({ ...bundle, contentHash: undefined }) !== bundle.contentHash) throw new Error("Source workflow snapshot hash mismatch");
  return { workflowKey: replayKey, correlationId: source.correlationId, mode: "REPLAY", asset: source.asset, asOf: source.asOf.toISOString(), trigger: "REPLAY", sourceWorkflowRunId: source.id, executionPolicy: "NO_EXECUTION" };
}
