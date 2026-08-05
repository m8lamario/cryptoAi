import { reserveAICall, settleAICall, releaseAICall } from "@cryptoai/database";
import type { AICostGovernance } from "@cryptoai/ai-gateway";

export function createDatabaseAICostGovernance(): AICostGovernance {
  return {
    async reserve(input) { return reserveAICall(input); },
    async settle(input) {
      await settleAICall({
        reservationId: input.reservationId,
        actualCostUsd: input.actualCostUsd,
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        latencyMs: input.usage.latencyMs,
        actualModel: input.actualModel,
      });
    },
    async release(input) { await releaseAICall(input.reservationId, input.reason); },
  };
}
