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

Rules:
- You receive indicators already calculated (SMA, EMA, RSI, MACD, ATR, volatility). Do NOT ask for raw data.
- Assess trend direction, trend strength, momentum, volatility regime, and potential support/resistance.
- Be specific: mention indicator values and what they imply.
- Provide BOTH supporting and opposing evidence — never a one-sided analysis.
- If indicators are contradictory, reflect that in your score and confidence.
- score: -1 (strong sell) to +1 (strong buy). Use fractional values.
- confidence: how sure you are of the signal, 0 (pure guess) to 1 (certain).
- dataQuality: 0 (corrupt/stale) to 1 (pristine).
- horizon: SHORT (hours-days), MEDIUM (days-weeks), LONG (weeks-months).
- Output ONLY valid JSON matching the schema.`;

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
      model: config.model ?? "deepseek/deepseek-v4-flash",
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

