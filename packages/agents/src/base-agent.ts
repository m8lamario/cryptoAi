import type { AIGateway, GatewayCallOptions } from "@cryptoai/ai-gateway";
import type { AgentReport } from "./agent-report.js";
import { unavailableReport, invalidReport } from "./agent-report.js";
import type { z } from "zod";

export interface BaseAgentConfig {
  agentId: string;
  agentVersion: string;
  promptVersion: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: "low" | "medium" | "high" | "xhigh";
}

export interface AgentRunContext {
  gateway: AIGateway;
  asset: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

/**
 * Base class for all AI agents.
 * Agents receive pre-computed deterministic data and produce structured AgentReports.
 * Agents cannot call OpenRouter directly — all calls go through the AI Gateway.
 */
export abstract class BaseAgent {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly promptVersion: string;
  readonly model: string;
  protected readonly callOptions: GatewayCallOptions;

  constructor(config: BaseAgentConfig) {
    this.agentId = config.agentId;
    this.agentVersion = config.agentVersion;
    this.promptVersion = config.promptVersion;
    this.model = config.model;
    this.callOptions = {
      model: config.model,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 1500,
      reasoning: config.reasoning ?? "high",
    };
  }

  /** Run the agent and produce an AgentReport */
  abstract run(context: AgentRunContext): Promise<AgentReport>;

  /** Call the gateway and produce a validated AgentReport */
  protected async callGateway<T extends z.ZodTypeAny>(
    gateway: AIGateway,
    systemPrompt: string,
    userPrompt: string,
    outputSchema: T,
    context: AgentRunContext,
  ): Promise<AgentReport> {
    const response = await gateway.structuredCall(
      systemPrompt,
      userPrompt,
      outputSchema,
      this.callOptions,
      this.promptVersion,
      "1.0.0",
    );

    if (response.status === "UNAVAILABLE") {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        response.error?.message ?? "AI Gateway unavailable",
      );
    }

    if (response.status === "INVALID") {
      return invalidReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        context.symbol,
        response.error?.message ?? "Invalid output from AI model",
      );
    }

    // VALID response — build the AgentReport
    const data = response.data as Record<string, unknown> | null;

    return {
      status: "VALID",
      runId: response.runId,
      agentId: this.agentId,
      agentVersion: this.agentVersion,
      promptVersion: this.promptVersion,
      requestedModel: response.requestedModel,
      actualModel: response.actualModel,
      asset: context.symbol,
      horizon: (data?.horizon as "SHORT" | "MEDIUM" | "LONG") ?? "SHORT",
      signal: (data?.signal as "BUY" | "SELL" | "HOLD" | "WAIT" | null) ?? null,
      score: typeof data?.score === "number" ? data.score : 0,
      confidence: typeof data?.confidence === "number" ? data.confidence : 0,
      dataQuality: typeof data?.dataQuality === "number" ? data.dataQuality : 0,
      reasoning: Array.isArray(data?.reasoning) ? data.reasoning as string[] : [],
      supportingEvidence: Array.isArray(data?.supportingEvidence) ? data.supportingEvidence as string[] : [],
      opposingEvidence: Array.isArray(data?.opposingEvidence) ? data.opposingEvidence as string[] : [],
      sourceIds: Array.isArray(data?.sourceIds) ? data.sourceIds as string[] : [],
      generatedAt: response.generatedAt,
      usage: response.usage ?? {
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        estimatedCostUsd: 0,
      },
    };
  }
}

