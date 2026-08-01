import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  AIProvider,
  GatewayCallOptions,
  GatewayResponse,
  UsageStats,
} from "./types.js";
import { AIGateway } from "./ai-gateway.js";
import type { AIGatewayConfig } from "./types.js";

// --- Multi-Model Gateway — matches ProjectPlan v1.4 Section 6 ---

export type ConsensusMode = "SINGLE" | "SECOND_OPINION" | "CONSENSUS";

/** A single model in the multi-model setup */
export interface MultiModelEntry {
  /** Role label (e.g., "technical", "manager") */
  role: string;
  /** Model identifier */
  model: string;
  /** Temperature override */
  temperature?: number;
  /** Max tokens override */
  maxTokens?: number;
  /** Reasoning effort override */
  reasoning?: "low" | "medium" | "high" | "xhigh";
}

export interface MultiModelConfig {
  mode: ConsensusMode;
  /** Primary model (always used) */
  primary: MultiModelEntry;
  /** Secondary model (used in SECOND_OPINION mode) */
  secondary?: MultiModelEntry;
  /** Additional models (used in CONSENSUS mode) */
  additional?: MultiModelEntry[];
  /** Minimum number of models that must agree in CONSENSUS mode */
  consensusMinAgreement?: number;
}

/** Aggregated usage across multiple model calls */
interface AggregatedUsage {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  calls: number;
}

/**
 * MultiModelGateway — wraps AIGateway to support multi-model strategies.
 *
 * Modes:
 * - SINGLE: call one model, return its result (passthrough).
 * - SECOND_OPINION: call primary, then secondary. If they disagree (different signals),
 *   return the primary result but flag the disagreement in metadata.
 * - CONSENSUS: call all models, require majority agreement on key outputs.
 *   If no majority, return UNAVAILABLE.
 *
 * The MultiModelGateway implements the same structuredCall interface as AIGateway
 * so it can be used as a drop-in replacement in agents.
 */
export class MultiModelGateway {
  private readonly config: MultiModelConfig;
  private readonly providers: Map<string, AIGateway>;

  constructor(config: MultiModelConfig, gatewayConfigs: Map<string, AIGatewayConfig>) {
    this.config = config;
    this.providers = new Map();

    // Create a gateway for each model entry
    const entries: MultiModelEntry[] = [config.primary];
    if (config.secondary) entries.push(config.secondary);
    if (config.additional) entries.push(...config.additional);

    for (const entry of entries) {
      const gwConfig = gatewayConfigs.get(entry.role) ?? gatewayConfigs.get("default");
      if (!gwConfig) {
        throw new Error(`No gateway config for role "${entry.role}" and no default`);
      }
      this.providers.set(entry.role, new AIGateway(gwConfig));
    }
  }

  /**
   * Make a structured AI call using the configured consensus strategy.
   * Same signature as AIGateway.structuredCall.
   */
  async structuredCall<T>(
    systemPrompt: string,
    userPrompt: string,
    outputSchema: z.ZodType<T>,
    options: GatewayCallOptions = {},
    promptVersion = "1.0.0",
    schemaVersion = "1.0.0",
  ): Promise<GatewayResponse<T>> {
    switch (this.config.mode) {
      case "SINGLE":
        return this.singleCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
      case "SECOND_OPINION":
        return this.secondOpinionCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
      case "CONSENSUS":
        return this.consensusCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
      default:
        return this.singleCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
    }
  }

  private async singleCall<T>(
    systemPrompt: string,
    userPrompt: string,
    outputSchema: z.ZodType<T>,
    options: GatewayCallOptions,
    promptVersion: string,
    schemaVersion: string,
  ): Promise<GatewayResponse<T>> {
    const gateway = this.providers.get(this.config.primary.role);
    if (!gateway) throw new Error(`No gateway for role "${this.config.primary.role}"`);

    return gateway.structuredCall(
      systemPrompt,
      userPrompt,
      outputSchema,
      { ...options, model: this.config.primary.model },
      promptVersion,
      schemaVersion,
    );
  }

  private async secondOpinionCall<T>(
    systemPrompt: string,
    userPrompt: string,
    outputSchema: z.ZodType<T>,
    options: GatewayCallOptions,
    promptVersion: string,
    schemaVersion: string,
  ): Promise<GatewayResponse<T>> {
    const primaryGw = this.providers.get(this.config.primary.role);
    const secondaryEntry = this.config.secondary;
    if (!primaryGw || !secondaryEntry) {
      // Fall back to SINGLE if secondary not configured
      return this.singleCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
    }

    const secondaryGw = this.providers.get(secondaryEntry.role);
    if (!secondaryGw) {
      return this.singleCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
    }

    // Run both in parallel
    const [primaryResult, secondaryResult] = await Promise.all([
      primaryGw.structuredCall(
        systemPrompt,
        userPrompt,
        outputSchema,
        { ...options, model: this.config.primary.model },
        promptVersion,
        schemaVersion,
      ),
      secondaryGw.structuredCall(
        systemPrompt,
        userPrompt,
        outputSchema,
        { ...options, model: secondaryEntry.model },
        promptVersion,
        schemaVersion,
      ),
    ]);

    // If primary is unavailable/invalid, try secondary as fallback
    if (primaryResult.status !== "VALID" && secondaryResult.status === "VALID") {
      return secondaryResult;
    }

    // If both are valid, check agreement
    if (primaryResult.status === "VALID" && secondaryResult.status === "VALID") {
      const agree = this.checkAgreement(primaryResult.data, secondaryResult.data);
      return {
        ...primaryResult,
        usage: this.aggregateUsage([
          primaryResult.usage as UsageStats,
          secondaryResult.usage as UsageStats,
        ]),
        // Attach disagreement info as part of the response
        // We return the primary but the caller can check agreement
        data: {
          ...(primaryResult.data as Record<string, unknown>),
          _secondOpinionAgrees: agree,
          _secondOpinionModel: secondaryResult.actualModel,
        } as unknown as T,
      };
    }

    // Primary valid, secondary not — use primary
    return {
      ...primaryResult,
      usage: this.aggregateUsage([
        primaryResult.usage as UsageStats,
        secondaryResult.usage as UsageStats,
      ]),
    };
  }

  private async consensusCall<T>(
    systemPrompt: string,
    userPrompt: string,
    outputSchema: z.ZodType<T>,
    options: GatewayCallOptions,
    promptVersion: string,
    schemaVersion: string,
  ): Promise<GatewayResponse<T>> {
    const entries = [this.config.primary];
    if (this.config.secondary) entries.push(this.config.secondary);
    if (this.config.additional) entries.push(...this.config.additional);

    if (entries.length < 2) {
      return this.singleCall(systemPrompt, userPrompt, outputSchema, options, promptVersion, schemaVersion);
    }

    const gates = entries.map((e) => this.providers.get(e.role)).filter(Boolean) as AIGateway[];

    // Run all models in parallel
    const results = await Promise.all(
      gates.map((gw, i) =>
        gw.structuredCall(
          systemPrompt,
          userPrompt,
          outputSchema,
          { ...options, model: entries[i]!.model },
          promptVersion,
          schemaVersion,
        ),
      ),
    );

    const validResults = results.filter((r) => r.status === "VALID");
    const minAgreement = this.config.consensusMinAgreement ?? Math.ceil(entries.length / 2);

    // Not enough valid responses
    if (validResults.length < minAgreement) {
      return {
        status: "UNAVAILABLE",
        data: null,
        usage: this.aggregateUsage(results.map((r) => r.usage).filter(Boolean) as UsageStats[]),
        error: {
          category: "VALIDATION_FAILED",
          message: `Consensus failed: ${validResults.length}/${entries.length} valid responses, minimum ${minAgreement} required`,
          retryable: false,
        },
        requestedModel: `consensus[${entries.map((e) => e.model).join(",")}]`,
        actualModel: null,
        promptVersion,
        schemaVersion,
        runId: randomUUID(),
        generatedAt: new Date().toISOString(),
      };
    }

    // Check if the valid results agree
    const agreementGroups = this.findAgreementGroups(validResults.map((r) => r.data!));
    const largestGroup = agreementGroups.reduce((max, g) => (g.length > max.length ? g : max), agreementGroups[0] ?? []);

    if (largestGroup.length < minAgreement) {
      return {
        status: "UNAVAILABLE",
        data: null,
        usage: this.aggregateUsage(results.map((r) => r.usage).filter(Boolean) as UsageStats[]),
        error: {
          category: "VALIDATION_FAILED",
          message: `No consensus: largest agreement group is ${largestGroup.length}/${validResults.length} (minimum ${minAgreement} required)`,
          retryable: false,
        },
        requestedModel: `consensus[${entries.map((e) => e.model).join(",")}]`,
        actualModel: null,
        promptVersion,
        schemaVersion,
        runId: randomUUID(),
        generatedAt: new Date().toISOString(),
      };
    }

    // Return the first result from the largest agreement group
    const chosen = validResults.find(
      (r) => JSON.stringify(r.data) === JSON.stringify(largestGroup[0]),
    ) ?? validResults[0]!;

    return {
      ...chosen,
      usage: this.aggregateUsage(results.map((r) => r.usage).filter(Boolean) as UsageStats[]),
    };
  }

  /**
   * Check if two model outputs agree on key fields.
   * For trading signals: checks action, signal, score direction.
   */
  private checkAgreement(a: unknown, b: unknown): boolean {
    if (a === null || b === null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;

    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;

    // Check action agreement
    const actionA = objA["action"];
    const actionB = objB["action"];
    if (actionA !== undefined && actionB !== undefined && actionA !== actionB) {
      return false;
    }

    // Check signal agreement
    const signalA = objA["signal"];
    const signalB = objB["signal"];
    if (signalA !== undefined && signalB !== undefined && signalA !== signalB) {
      return false;
    }

    // Check score direction (both positive or both negative)
    if (typeof objA["score"] === "number" && typeof objB["score"] === "number") {
      const scoreA = objA["score"] as number;
      const scoreB = objB["score"] as number;
      if ((scoreA > 0) !== (scoreB > 0)) return false;
    }

    return true;
  }

  /**
   * Group outputs that agree with each other.
   */
  private findAgreementGroups<T>(outputs: T[]): T[][] {
    const groups: T[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < outputs.length; i++) {
      if (used.has(i)) continue;
      const group: T[] = [outputs[i]!];
      used.add(i);

      for (let j = i + 1; j < outputs.length; j++) {
        if (used.has(j)) continue;
        if (this.checkAgreement(outputs[j], outputs[i])) {
          group.push(outputs[j]!);
          used.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private aggregateUsage(usages: UsageStats[]): UsageStats {
    const filtered = usages.filter((u) => u !== null);
    if (filtered.length === 0) {
      return { promptTokens: 0, completionTokens: 0, latencyMs: 0, estimatedCostUsd: 0 };
    }
    return {
      promptTokens: filtered.reduce((s, u) => s + u.promptTokens, 0),
      completionTokens: filtered.reduce((s, u) => s + u.completionTokens, 0),
      latencyMs: Math.max(...filtered.map((u) => u.latencyMs)),
      estimatedCostUsd: filtered.reduce((s, u) => s + u.estimatedCostUsd, 0),
    };
  }

  // --- Budget methods (delegated to primary) ---
  getDailySpent(): number {
    return this.providers.get(this.config.primary.role)?.getDailySpent() ?? 0;
  }

  getMonthlySpent(): number {
    return this.providers.get(this.config.primary.role)?.getMonthlySpent() ?? 0;
  }
}
