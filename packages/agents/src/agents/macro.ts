import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";

export interface MacroAgentInput {
  symbol: string;
  price: number;
  change24h: number | null;
  volatility: number | null;
  /** Crypto-specific macro indicators (pre-computed) */
  btcDominance: number | null;
  fearGreedIndex: number | null;
  totalMarketCap: number | null;
  /** Traditional macro indicators */
  sp500Change24h: number | null;
  dxy: number | null;
  /** Federal funds rate (string for flexibility) */
  fedFundsRate: number | null;
}

const MacroOutputSchema = z.object({
  signal: z.enum(["BUY", "SELL", "HOLD", "WAIT"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  horizon: z.enum(["SHORT", "MEDIUM", "LONG"]),
  regime: z.enum(["risk-on", "neutral", "risk-off"]),
  reasoning: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).max(6),
  opposingEvidence: z.array(z.string()).max(6),
  sourceIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are the Macro AI Analyst for a hybrid crypto investment system.

Your role: interpret macro-economic and crypto-market-wide indicators to determine the current risk regime.

You MUST respond with ONLY a JSON object matching exactly this schema:
{
  "signal": "BUY" | "SELL" | "HOLD" | "WAIT",
  "score": number between -1 and 1,
  "confidence": number between 0 and 1,
  "dataQuality": number between 0 and 1,
  "horizon": "SHORT" | "MEDIUM" | "LONG",
  "regime": "risk-on" | "neutral" | "risk-off",
  "reasoning": ["string", "string", ...] (1-8 items),
  "supportingEvidence": ["string", ...] (0-6 items),
  "opposingEvidence": ["string", ...] (0-6 items),
  "sourceIds": ["string", ...]
}

Rules:
- All fields are REQUIRED. Use empty arrays [] for supportingEvidence/opposingEvidence/sourceIds if none.
- Numbers must be actual numbers, not strings.
- Arrays must be arrays of strings.
- regime: risk-on favors crypto, risk-off suggests caution, neutral is in-between.
- score: -1 (bearish macro) to +1 (bullish macro). Use fractional values.
- confidence: how sure you are of your assessment.
- dataQuality: quality of the macro data available.
- Be specific about WHY the regime is what you think it is.
- Provide BOTH supporting and opposing evidence.`;

function buildUserPrompt(input: MacroAgentInput): string {
  const fgi = input.fearGreedIndex;
  const fearGreedLabel =
    fgi !== null
      ? fgi <= 25 ? "Extreme Fear"
      : fgi <= 45 ? "Fear"
      : fgi <= 55 ? "Neutral"
      : fgi <= 75 ? "Greed"
      : "Extreme Greed"
      : "N/A";

  return [
    `Asset: ${input.symbol}`,
    `Current Price: ${input.price}`,
    `24h Change: ${input.change24h !== null ? `${input.change24h.toFixed(2)}%` : "N/A"}`,
    "",
    "=== Crypto Market Macro ===",
    `BTC Dominance: ${input.btcDominance !== null ? `${input.btcDominance.toFixed(2)}%` : "N/A"}`,
    `Fear & Greed Index: ${fgi !== null ? `${fgi} (${fearGreedLabel})` : "N/A"}`,
    `Total Crypto Market Cap: ${input.totalMarketCap !== null ? `$${(input.totalMarketCap / 1e9).toFixed(2)}B` : "N/A"}`,
    `Annualized Volatility: ${input.volatility !== null ? `${(input.volatility * 100).toFixed(2)}%` : "N/A"}`,
    "",
    "=== Traditional Macro ===",
    `S&P 500 (24h change): ${input.sp500Change24h !== null ? `${input.sp500Change24h.toFixed(2)}%` : "N/A"}`,
    `DXY (US Dollar Index): ${input.dxy?.toFixed(2) ?? "N/A"}`,
    `Fed Funds Rate: ${input.fedFundsRate !== null ? `${input.fedFundsRate.toFixed(2)}%` : "N/A"}`,
    "",
    "Determine the risk regime and provide your macro assessment as valid JSON.",
  ].join("\n");
}

export class MacroAgent extends BaseAgent {
  constructor(config: Partial<BaseAgentConfig> = {}) {
    super({
      agentId: config.agentId ?? "macro-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model,
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    });
  }

  async run(context: AgentRunContext & { input: MacroAgentInput }): Promise<AgentReport> {
    try {
      const userPrompt = buildUserPrompt(context.input);

      return await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        MacroOutputSchema,
        context,
      );
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        err instanceof Error ? err.message : "Macro agent failed",
      );
    }
  }
}
