export {
  initPaperBalance,
  getPaperPortfolio,
  executePaperBuy,
  executePaperSell,
  markToMarket,
} from "./executor.js";
export type { PaperExecutorConfig, ExecutionResult } from "./executor.js";

export {
  runBuyAndHold,
  runQuantitativeBot,
  runHybridBacktest,
} from "./backtest.js";
export type { BacktestConfig, BacktestMetrics } from "./backtest.js";

