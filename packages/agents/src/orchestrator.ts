import type { AIGateway } from "@cryptoai/ai-gateway";
import type { AgentReport } from "./agent-report.js";
import { unavailableReport } from "./agent-report.js";
import type { BaseAgent, AgentRunContext } from "./base-agent.js";

export interface AgentRunResult {
  agentId: string;
  report: AgentReport;
}

export interface OrchestratorConfig {
  gateway: AIGateway;
  agents: BaseAgent[];
}

/**
 * Agent Orchestrator — runs all AI agents for a single asset.
 *
 * The orchestrator:
 * - Runs agents concurrently (no cross-contamination)
 * - Collects all AgentReports
 * - Does NOT make trading decisions — that's the Investment Manager's job (Phase 4)
 */
export class AgentOrchestrator {
  private readonly gateway: AIGateway;
  private readonly agents: BaseAgent[];

  constructor(config: OrchestratorConfig) {
    this.gateway = config.gateway;
    this.agents = config.agents;
  }

  /**
   * Run all agents for a single asset.
   * Agents run concurrently via Promise.allSettled — one failing agent doesn't block others.
   */
  async runAll(
    assetContext: Omit<AgentRunContext, "symbol" | "baseAsset" | "quoteAsset"> & {
      symbol: string;
      baseAsset: string;
      quoteAsset: string;
    },
    inputs: Record<string, unknown> = {},
  ): Promise<AgentRunResult[]> {
    const context: AgentRunContext = {
      gateway: this.gateway,
      asset: assetContext.asset,
      symbol: assetContext.symbol,
      baseAsset: assetContext.baseAsset,
      quoteAsset: assetContext.quoteAsset,
    };

    const tasks = this.agents.map(async (agent): Promise<AgentRunResult> => {
      try {
        // Each agent receives its own input from the inputs map
        const agentInput = inputs[agent.agentId];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const report = await agent.run({
          ...context,
          input: agentInput,
        } as any);

        return { agentId: agent.agentId, report };
      } catch (err) {
        return {
          agentId: agent.agentId,
          report: unavailableReport(
            agent.agentId,
            agent.agentVersion,
            agent.promptVersion,
            agent.model,
            context.symbol,
            err instanceof Error ? err.message : "Agent execution failed",
          ),
        };
      }
    });

    const results = await Promise.allSettled(tasks);

    return results.map((r, idx) => {
      if (r.status === "fulfilled") return r.value;
      return {
        agentId: this.agents[idx]?.agentId ?? "unknown",
        report: unavailableReport(
          "unknown",
          "0.0.0",
          "0.0.0",
          "unknown",
          context.symbol,
          "Agent execution rejected",
        ),
      };
    });
  }

  /** Get the list of agent IDs managed by this orchestrator */
  get agentIds(): string[] {
    return this.agents.map((a) => a.agentId);
  }
}

