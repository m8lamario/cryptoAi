import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";

export interface NewsAgentInput {
  symbol: string;
  /** Pre-collected and normalized news headlines/titles */
  headlines: Array<{
    title: string;
    source: string;
    publishedAt: string;
    /** Optional: brief snippet */
    snippet?: string;
  }>;
}

const NewsOutputSchema = z.object({
  signal: z.enum(["BUY", "SELL", "HOLD", "WAIT"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  horizon: z.enum(["SHORT", "MEDIUM", "LONG"]),
  facts: z.array(z.string()).max(6),
  opinions: z.array(z.string()).max(6),
  unverifiedRumors: z.array(z.string()).max(6),
  reasoning: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).max(6),
  opposingEvidence: z.array(z.string()).max(6),
  sourceIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are the News AI Analyst for a hybrid crypto investment system.

Your role: analyze pre-collected news headlines for a single asset and distinguish facts from opinions and unverified rumors.

Rules:
- You receive only headlines/titles (and optional snippets) — do NOT ask for full articles.
- Categorize each headline as: fact, opinion, or unverified rumor.
- Assess the overall impact: positive, negative, or neutral.
- Be specific about WHICH headline supports WHICH conclusion.
- Provide BOTH supporting and opposing evidence.
- If news is sparse, reflect that in lower confidence and dataQuality.
- score: -1 (bearish news) to +1 (bullish news).
- Output ONLY valid JSON.`;

function buildUserPrompt(input: NewsAgentInput): string {
  const lines: string[] = [
    `Asset: ${input.symbol}`,
    "",
    `=== News Headlines (${input.headlines.length} items) ===`,
    "",
  ];

  for (const h of input.headlines) {
    lines.push(`[${h.source}] ${h.publishedAt}`);
    lines.push(`Title: ${h.title}`);
    if (h.snippet) {
      lines.push(`Snippet: ${h.snippet}`);
    }
    lines.push("");
  }

  lines.push("Categorize each headline (fact/opinion/rumor) and provide your assessment as valid JSON.");
  return lines.join("\n");
}

export class NewsAgent extends BaseAgent {
  constructor(config: Partial<BaseAgentConfig> = {}) {
    super({
      agentId: config.agentId ?? "news-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model ?? "deepseek/deepseek-v4-pro",
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    });
  }

  async run(context: AgentRunContext & { input: NewsAgentInput }): Promise<AgentReport> {
    try {
      const userPrompt = buildUserPrompt(context.input);

      return await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        NewsOutputSchema,
        context,
      );
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        err instanceof Error ? err.message : "News agent failed",
      );
    }
  }
}

