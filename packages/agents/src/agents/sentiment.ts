import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";

export interface SentimentAgentInput {
  symbol: string;
  /** Pre-collected, cleaned, and deduplicated social media posts */
  posts: Array<{
    text: string;
    platform: string;
    engagement: number;
    timestamp: string;
  }>;
  /** Aggregate metrics computed deterministically */
  metrics: {
    totalPosts: number;
    positiveRatio: number;
    negativeRatio: number;
    neutralRatio: number;
    engagementTotal: number;
  };
}

const SentimentOutputSchema = z.object({
  signal: z.enum(["BUY", "SELL", "HOLD", "WAIT"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  horizon: z.enum(["SHORT", "MEDIUM", "LONG"]),
  sentimentLabel: z.enum(["euphoric", "bullish", "neutral", "fearful", "panicked"]),
  reasoning: z.array(z.string()).min(1).max(8),
  supportingEvidence: z.array(z.string()).max(6),
  opposingEvidence: z.array(z.string()).max(6),
  sourceIds: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are the Sentiment AI Analyst for a hybrid crypto investment system.

Your role: evaluate pre-collected and cleaned social media posts to assess market sentiment.

Rules:
- You receive already-filtered and deduplicated posts. Do NOT ask for raw unfiltered data.
- Assess overall sentiment: euphoric, bullish, neutral, fearful, or panicked.
- Consider the ratio of positive/negative/neutral posts.
- Consider engagement levels — high engagement amplifies sentiment.
- Be aware that social media can be manipulated (bots, coordinated campaigns).
- Provide BOTH supporting and opposing evidence.
- If the sample is too small or low quality, reflect that in confidence and dataQuality.
- score: -1 (extreme fear/panic) to +1 (extreme greed/euphoria).
- Output ONLY valid JSON.`;

function buildUserPrompt(input: SentimentAgentInput): string {
  const m = input.metrics;
  const lines: string[] = [
    `Asset: ${input.symbol}`,
    "",
    "=== Sentiment Metrics (pre-computed) ===",
    `Total Posts: ${m.totalPosts}`,
    `Positive Ratio: ${(m.positiveRatio * 100).toFixed(1)}%`,
    `Negative Ratio: ${(m.negativeRatio * 100).toFixed(1)}%`,
    `Neutral Ratio: ${(m.neutralRatio * 100).toFixed(1)}%`,
    `Total Engagement: ${m.engagementTotal}`,
    "",
    `=== Sample Posts (${input.posts.length} items) ===`,
    "",
  ];

  for (const p of input.posts) {
    lines.push(
      `[${p.platform}] ${p.timestamp} | Engagement: ${p.engagement}`,
    );
    lines.push(`"${p.text}"`);
    lines.push("");
  }

  lines.push("Assess the sentiment and provide your analysis as valid JSON.");
  return lines.join("\n");
}

export class SentimentAgent extends BaseAgent {
  constructor(config: Partial<BaseAgentConfig> = {}) {
    super({
      agentId: config.agentId ?? "sentiment-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model ?? "deepseek/deepseek-v4-pro",
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    });
  }

  async run(context: AgentRunContext & { input: SentimentAgentInput }): Promise<AgentReport> {
    try {
      const userPrompt = buildUserPrompt(context.input);

      return await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        SentimentOutputSchema,
        context,
      );
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        err instanceof Error ? err.message : "Sentiment agent failed",
      );
    }
  }
}

