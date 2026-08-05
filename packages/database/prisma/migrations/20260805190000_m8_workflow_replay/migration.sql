-- M8: durable workflow runs, phases and immutable artifact references.
CREATE TABLE "WorkflowRun" (
  "id" TEXT NOT NULL, "workflowKey" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "parentRunId" TEXT, "mode" TEXT NOT NULL, "trigger" TEXT NOT NULL, "asset" TEXT NOT NULL, "asOf" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL, "executionPolicy" TEXT NOT NULL, "snapshotBundle" JSONB NOT NULL, "snapshotHash" TEXT NOT NULL, "configurationSnapshotIds" TEXT[] NOT NULL, "bullJobId" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowRun_workflowKey_key" ON "WorkflowRun"("workflowKey");
CREATE INDEX "WorkflowRun_correlationId_createdAt_idx" ON "WorkflowRun"("correlationId", "createdAt");
CREATE INDEX "WorkflowRun_status_createdAt_idx" ON "WorkflowRun"("status", "createdAt");
CREATE TABLE "WorkflowPhase" (
  "id" TEXT NOT NULL, "workflowRunId" TEXT NOT NULL, "name" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "status" TEXT NOT NULL, "attempt" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3, "inputJson" JSONB, "outputJson" JSONB, "inputHash" TEXT, "outputHash" TEXT, "errorJson" JSONB, "startedAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowPhase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowPhase_workflowRunId_name_key" ON "WorkflowPhase"("workflowRunId", "name");
CREATE INDEX "WorkflowPhase_workflowRunId_sequence_idx" ON "WorkflowPhase"("workflowRunId", "sequence");
CREATE INDEX "WorkflowPhase_status_updatedAt_idx" ON "WorkflowPhase"("status", "updatedAt");
ALTER TABLE "WorkflowPhase" ADD CONSTRAINT "WorkflowPhase_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "WorkflowArtifact" (
  "id" TEXT NOT NULL, "workflowRunId" TEXT NOT NULL, "phaseName" TEXT NOT NULL, "artifactType" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "role" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowArtifact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowArtifact_workflowRunId_phaseName_artifactType_entityId_key" ON "WorkflowArtifact"("workflowRunId", "phaseName", "artifactType", "entityId");
CREATE INDEX "WorkflowArtifact_entityType_entityId_idx" ON "WorkflowArtifact"("entityType", "entityId");
ALTER TABLE "WorkflowArtifact" ADD CONSTRAINT "WorkflowArtifact_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

