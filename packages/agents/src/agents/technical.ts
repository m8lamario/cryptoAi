import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";

/**
 * Data passed to the Technical AI Agent.
 * The agent receives pre-computed indicators — it does NOT calculate them.
 */
export interface TechnicalAgentInput {
  symbol: string;
  price: number;
  change24h: number | null;
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  volatility: number | null;
  recentCandles: Array<{
    openTime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

const TechnicalOutputSchema = z.object({
  signal: z.enum(["BUY", "SELL", "HOLD", "WAIT"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  horizon: z.enum(["SHORT", "MEDIUM", "LONG"]),
  reasoning: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).max(6),
  opposingEvidence: z.array(z.string()).max(6),
  sourceIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are the Technical AI Analyst for a hybrid crypto investment system.

Your role: interpret pre-computed technical indicators for a single asset and produce a structured assessment.

You MUST respond with ONLY a JSON object matching exactly this schema:
{
  "signal": "BUY" | "SELL" | "HOLD" | "WAIT",
  "score": number between -1 and 1,
  "confidence": number between 0 and 1,
  "dataQuality": number between 0 and 1,
  "horizon": "SHORT" | "MEDIUM" | "LONG",
  "reasoning": ["string", "string", ...] (1-8 items, each a short sentence),
  "supportingEvidence": ["string", ...] (0-6 items),
  "opposingEvidence": ["string", ...] (0-6 items),
  "sourceIds": ["string", ...]
}

Rules:
- All fields are REQUIRED. Use empty arrays [] for supportingEvidence/opposingEvidence/sourceIds if none.
- Numbers must be actual numbers, not strings like "0.7".
- Arrays must be arrays of strings, not a single string.
- score: -1 (strong sell) to +1 (strong buy). Use fractional values like 0.35.
- confidence: how sure you are, 0 (guess) to 1 (certain).
- dataQuality: 0 (stale) to 1 (pristine).
- horizon: SHORT (hours), MEDIUM (days-weeks), LONG (weeks-months).
- Be specific in reasoning: mention indicator values.
- Provide BOTH supporting and opposing evidence.`;

function buildUserPrompt(input: TechnicalAgentInput): string {
  const lines: string[] = [
    `Asset: ${input.symbol}`,
    `Current Price: ${input.price}`,
    `24h Change: ${input.change24h !== null ? `${input.change24h.toFixed(2)}%` : "N/A"}`,
    "",
    "=== Technical Indicators ===",
    `SMA(20): ${input.sma20?.toFixed(2) ?? "N/A"}`,
    `SMA(50): ${input.sma50?.toFixed(2) ?? "N/A"}`,
    `EMA(20): ${input.ema20?.toFixed(2) ?? "N/A"}`,
    `RSI(14): ${input.rsi14?.toFixed(2) ?? "N/A"}`,
    `MACD Line: ${input.macd?.toFixed(4) ?? "N/A"}`,
    `MACD Signal: ${input.macdSignal?.toFixed(4) ?? "N/A"}`,
    `MACD Histogram: ${input.macdHistogram?.toFixed(4) ?? "N/A"}`,
    `ATR(14): ${input.atr14?.toFixed(4) ?? "N/A"}`,
    `Annualized Volatility: ${input.volatility !== null ? `${(input.volatility * 100).toFixed(2)}%` : "N/A"}`,
    "",
    "=== Recent Price Action (last 8 candles, 15min) ===",
  ];

  for (const c of input.recentCandles) {
    lines.push(
      `${c.openTime} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(4)}`,
    );
  }

  lines.push("");
  lines.push("Provide your technical assessment as valid JSON.");

  return lines.join("\n");
}

export class TechnicalAgent extends BaseAgent {
  constructor(config: Partial<BaseAgentConfig> = {}) {
    super({
      agentId: config.agentId ?? "technical-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model,
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    });
  }

  async run(context: AgentRunContext & { input: TechnicalAgentInput }): Promise<AgentReport> {
    try {
      const userPrompt = buildUserPrompt(context.input);

      return await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        TechnicalOutputSchema,
        context,
      );
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        err instanceof Error ? err.message : "Technical agent failed",
      );
    }
  }
}
