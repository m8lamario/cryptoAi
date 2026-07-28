import { describe, it, expect } from "vitest";
import { evaluateTradeProposal } from "../src/risk-manager.js";
import type { TradeProposal, RiskProfileConfig, PortfolioSnapshot, AssetPrice } from "../src/types.js";
import type { RiskManagerOptions } from "../src/risk-manager.js";

const defaultRiskProfile: RiskProfileConfig = {
  maxPortfolioExposurePercent: 50,
  maxAssetExposurePercent: 30,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 20,
};

const healthyPortfolio: PortfolioSnapshot = {
  totalValue: 10000,
  currentExposure: 500,
  assetExposure: 0,
  peakValue: 12000,
  dailyPnl: 50,
};

const now = new Date("2026-07-28T12:00:00Z");

const recentPrice: AssetPrice = {
  symbol: "BTCUSDT",
  price: 65000,
  collectedAt: new Date("2026-07-28T11:55:00Z"), // 5 min ago
};

function makeProposal(overrides: Partial<TradeProposal> = {}): TradeProposal {
  return {
    status: "VALID",
    asset: "BTCUSDT",
    action: "BUY",
    confidence: 0.75,
    suggestedRiskFraction: 0.02,
    expiresAt: new Date("2026-07-28T13:00:00Z").toISOString(),
    ...overrides,
  };
}

function makeOptions(overrides: Partial<RiskManagerOptions> = {}): RiskManagerOptions {
  return {
    riskProfile: defaultRiskProfile,
    portfolio: healthyPortfolio,
    prices: [recentPrice],
    killSwitchActive: false,
    minConfidence: 0.5,
    minPositionSize: 0.001,
    maxDataAgeMs: 30 * 60 * 1000, // 30 min
    now,
    atrValue: 1200,
    ...overrides,
  };
}

describe("Risk Manager — Approval", () => {
  it("approves a valid BUY proposal", () => {
    const decision = evaluateTradeProposal(makeProposal(), makeOptions());
    expect(decision.status).toBe("APPROVE");
    expect(decision.ruleCode).toBe("APPROVED");
    expect(decision.positionSize).toBeGreaterThan(0);
    expect(decision.stopLoss).not.toBeNull();
  });

  it("approves a valid SELL proposal", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ action: "SELL" }),
      makeOptions(),
    );
    expect(decision.status).toBe("APPROVE");
  });

  it("idempotency key is consistent for same proposal+time", () => {
    const decision1 = evaluateTradeProposal(makeProposal(), makeOptions());
    const decision2 = evaluateTradeProposal(makeProposal(), makeOptions());
    expect(decision1.idempotencyKey).toBe(decision2.idempotencyKey);
  });
});

describe("Risk Manager — Kill switch", () => {
  it("blocks when kill switch is active", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({ killSwitchActive: true }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("KILL_SWITCH_ACTIVE");
  });
});

describe("Risk Manager — Data staleness", () => {
  it("blocks when no prices are available", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({ prices: [] }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("DATA_TOO_STALE");
  });

  it("blocks when data is too old", () => {
    const oldPrice: AssetPrice = {
      symbol: "BTCUSDT",
      price: 65000,
      collectedAt: new Date("2026-07-28T11:15:00Z"), // 45 min ago
    };
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({ prices: [oldPrice], maxDataAgeMs: 30 * 60 * 1000 }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("DATA_TOO_STALE");
  });
});

describe("Risk Manager — Proposal status", () => {
  it("blocks NO_ACTION proposals", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ status: "NO_ACTION" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("NO_ACTION_PROPOSAL");
  });

  it("blocks UNAVAILABLE proposals", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ status: "UNAVAILABLE" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("UNAVAILABLE_PROPOSAL");
  });

  it("blocks INVALID proposals", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ status: "INVALID" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("INVALID_PROPOSAL");
  });

  it("blocks AMBIGUOUS proposals", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ status: "AMBIGUOUS" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("AMBIGUOUS_PROPOSAL");
  });

  it("blocks HOLD action", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ action: "HOLD" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("NO_ACTION_PROPOSAL");
  });

  it("blocks WAIT action", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ action: "WAIT" }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("NO_ACTION_PROPOSAL");
  });

  it("blocks null action", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ action: null }),
      makeOptions(),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("NULL_ACTION");
  });
});

describe("Risk Manager — Confidence", () => {
  it("blocks low confidence proposals", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ confidence: 0.3 }),
      makeOptions({ minConfidence: 0.5 }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("CONFIDENCE_TOO_LOW");
  });
});

describe("Risk Manager — Daily loss", () => {
  it("blocks when daily loss exceeds limit", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({
        portfolio: {
          ...healthyPortfolio,
          totalValue: 10000,
          dailyPnl: -600, // -6% daily loss
        },
        riskProfile: {
          ...defaultRiskProfile,
          maxDailyLossPercent: 5,
        },
      }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("MAX_DAILY_LOSS");
  });

  it("allows when daily loss is within limit", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({
        portfolio: {
          ...healthyPortfolio,
          totalValue: 10000,
          dailyPnl: -400, // -4% daily loss
        },
        riskProfile: {
          ...defaultRiskProfile,
          maxDailyLossPercent: 5,
        },
      }),
    );
    expect(decision.status).toBe("APPROVE");
  });
});

describe("Risk Manager — Drawdown", () => {
  it("blocks when drawdown exceeds limit", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({
        portfolio: {
          ...healthyPortfolio,
          totalValue: 7500, // 25% drawdown from peak 12000
          peakValue: 10000,
        },
        riskProfile: {
          ...defaultRiskProfile,
          maxDrawdownPercent: 20,
        },
      }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("MAX_DRAWDOWN");
  });
});

describe("Risk Manager — Position sizing", () => {
  it("blocks when position size is below minimum", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({
        portfolio: {
          totalValue: 100,
          currentExposure: 0,
          assetExposure: 0,
          peakValue: 100,
          dailyPnl: 0,
        },
        riskProfile: {
          ...defaultRiskProfile,
          maxAssetExposurePercent: 0.01,
        },
        minPositionSize: 0.1,
      }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("POSITION_SIZE_BELOW_MINIMUM");
  });
});

describe("Risk Manager — Portfolio exposure", () => {
  it("blocks when total exposure would exceed limit", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ suggestedRiskFraction: 1.0 }),
      makeOptions({
        portfolio: {
          ...healthyPortfolio,
          totalValue: 10000,
          currentExposure: 4500, // 45% already exposed
        },
        riskProfile: {
          ...defaultRiskProfile,
          maxPortfolioExposurePercent: 50,
          maxAssetExposurePercent: 100,
        },
      }),
    );
    // The proposal with riskFraction 1.0 will try to allocate 10000
    // But maxAssetExposure (30%) caps position, then portfolio exposure check applies
    // Let's just verify it blocks for exposure
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("MAX_PORTFOLIO_EXPOSURE");
  });
});

describe("Risk Manager — Asset exposure", () => {
  it("blocks when existing asset exposure plus the new position exceeds the limit", () => {
    const decision = evaluateTradeProposal(
      makeProposal(),
      makeOptions({
        portfolio: { ...healthyPortfolio, assetExposure: 2_900 },
        riskProfile: { ...defaultRiskProfile, maxAssetExposurePercent: 30 },
      }),
    );

    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("MAX_ASSET_EXPOSURE");
  });
});

describe("Risk Manager — Missing stop loss", () => {
  it("blocks when ATR is null (no stop loss)", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ suggestedRiskFraction: 0.02 }),
      makeOptions({ atrValue: null }),
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("MISSING_STOP_LOSS");
  });
});

describe("Risk Manager — Missing asset price", () => {
  it("blocks when asset is not in prices list", () => {
    const decision = evaluateTradeProposal(
      makeProposal({ asset: "ETHUSDT" }),
      makeOptions({ prices: [recentPrice] }), // Only BTCUSDT available
    );
    expect(decision.status).toBe("BLOCK");
    expect(decision.ruleCode).toBe("DATA_TOO_STALE");
  });
});
