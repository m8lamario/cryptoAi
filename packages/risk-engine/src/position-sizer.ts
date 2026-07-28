import type { PositionSizingInput, PositionSizingResult } from "./types.js";

/**
 * Deterministic Position Sizer.
 *
 * Calculates the position size based on portfolio value, risk fraction,
 * and optional ATR-based stop loss.
 *
 * The AI Manager suggests a `riskFraction`, but the final size is always
 * calculated deterministically here.
 */
export function computePositionSize(input: PositionSizingInput): PositionSizingResult {
  const { portfolioValue, entryPrice, atrValue, riskFraction, maxAssetExposurePercent, minPositionSize } = input;

  // 1. Risk-based sizing: riskAmount = portfolioValue * riskFraction
  const riskAmount = portfolioValue * riskFraction;

  // 2. Compute stop loss (if ATR available)
  // Stop loss at 2x ATR below entry, or null if no ATR
  const stopLoss = atrValue !== null && atrValue > 0 ? entryPrice - 2 * atrValue : null;

  // 3. Position size based on stop loss distance
  let positionSize: number;
  if (stopLoss !== null && stopLoss > 0 && stopLoss < entryPrice) {
    const riskPerUnit = entryPrice - stopLoss;
    positionSize = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  } else {
    // No ATR-based stop loss: use a fixed 5% stop
    const fallbackStopDistance = entryPrice * 0.05;
    positionSize = fallbackStopDistance > 0 ? riskAmount / fallbackStopDistance : 0;
  }

  // 4. Enforce max asset exposure limit
  const maxAssetNotional = portfolioValue * (maxAssetExposurePercent / 100);
  const maxAssetPositionSize = maxAssetNotional / entryPrice;
  positionSize = Math.min(positionSize, maxAssetPositionSize);

  // 5. Enforce minimum position size
  if (positionSize < minPositionSize) {
    positionSize = 0;
  }

  return {
    // Never round a capped position upward: that could exceed the configured
    // exposure limit by a few satoshis.
    positionSize: Math.floor(positionSize * 1e8) / 1e8,
    stopLoss: stopLoss !== null ? Math.round(stopLoss * 1e8) / 1e8 : null,
    riskAmount: Math.round(riskAmount * 100) / 100,
  };
}

