import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";

export interface WhaleAgentInput {
  symbol: string;
  /** Pre-normalized large transactions */
  transactions: Array<{
    amount: number;
    amountUsd: number;
    from: string;
    to: string;
    timestamp: string;
    /** Classification: exchange_inflow, exchange_outflow, internal_transfer, unknown */
    category: "exchange_inflow" | "exchange_outflow" | "internal_transfer" | "unknown";
  }>;
  /** Deterministic summary metrics */
  summary: {
    totalInflowUsd: number;
    totalOutflowUsd: number;
    netFlowUsd: number;
    transactionCount: number;
    exchangeInflowCount: number;
    exchangeOutflowCount: number;
  };
}

const WhaleOutputSchema = z.object({
  signal: z.enum(["BUY", "SELL", "HOLD", "WAIT"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  horizon: z.enum(["SHORT", "MEDIUM", "LONG"]),
  netFlowAssessment: z.enum(["accumulation", "distribution", "neutral"]),
  reasoning: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).max(6),
  opposingEvidence: z.array(z.string()).max(6),
  sourceIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are the Whale AI Analyst for a hybrid crypto investment system.

Your role: interpret pre-normalized large on-chain transactions to detect whale accumulation or distribution.

Rules:
- You receive already-classified transactions (exchange_inflow, exchange_outflow, internal_transfer, unknown).
- Inflow to exchange = potential selling pressure (bearish).
- Outflow from exchange = potential accumulation (bullish).
- Internal transfers and unknown should be noted but discounted.
- Distinguish between a few large transactions (whale-specific) and many small ones (retail).
- Cross-reference with summary metrics (net flow, count, volumes).
- Provide BOTH supporting and opposing evidence.
- score: -1 (heavy distribution) to +1 (heavy accumulation).
- Output ONLY valid JSON.`;

function buildUserPrompt(input: WhaleAgentInput): string {
  const s = input.summary;
  const lines: string[] = [
    `Asset: ${input.symbol}`,
    "",
    "=== Whale Transaction Summary (pre-computed) ===",
    `Total Inflow (to exchanges): $${s.totalInflowUsd.toLocaleString()}`,
    `Total Outflow (from exchanges): $${s.totalOutflowUsd.toLocaleString()}`,
    `Net Flow: $${s.netFlowUsd.toLocaleString()} (${s.netFlowUsd >= 0 ? "net accumulation" : "net distribution"})`,
    `Total Transactions: ${s.transactionCount}`,
    `Exchange Inflow Count: ${s.exchangeInflowCount}`,
    `Exchange Outflow Count: ${s.exchangeOutflowCount}`,
    "",
    `=== Top Transactions (${input.transactions.length} items) ===`,
    "",
  ];

  for (const tx of input.transactions) {
    lines.push(
      `${tx.timestamp} | ${tx.category} | $${tx.amountUsd.toLocaleString()} | ${tx.from} → ${tx.to}`,
    );
    lines.push(`  Amount: ${tx.amount.toFixed(4)} ${input.symbol.replace("USDT", "")}`);
    lines.push("");
  }

  lines.push("Interpret the whale activity and provide your assessment as valid JSON.");
  return lines.join("\n");
}

export class WhaleAgent extends BaseAgent {
  constructor(config: Partial<BaseAgentConfig> = {}) {
    super({
      agentId: config.agentId ?? "whale-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model ?? "deepseek/deepseek-v4-flash",
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    });
  }

  async run(context: AgentRunContext & { input: WhaleAgentInput }): Promise<AgentReport> {
    try {
      const userPrompt = buildUserPrompt(context.input);

      return await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        WhaleOutputSchema,
        context,
      );
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        err instanceof Error ? err.message : "Whale agent failed",
      );
    }
  }
}

