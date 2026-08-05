import { executePaperBuy, executePaperSell, type PaperExecutorConfig } from "@cryptoai/paper-executor";

export async function executeApprovedPaperDecision(input: {
  executionPolicy: "PAPER_ALLOWED" | "NO_EXECUTION";
  action: "BUY" | "SELL";
  asset: string;
  quantity: number;
  price: number;
  config: PaperExecutorConfig;
  proposalRunId: string;
  executionKey: string;
  stopLoss?: number | null;
}) {
  if (input.executionPolicy !== "PAPER_ALLOWED") return { status: "SKIPPED" as const, reason: "NO_EXECUTION policy" };
  if (input.action === "BUY") return executePaperBuy(input.asset, input.quantity, input.price, input.config, input.proposalRunId, input.executionKey, { stopLoss: input.stopLoss });
  return executePaperSell(input.asset, input.quantity, input.price, input.config, input.proposalRunId, input.executionKey);
}

