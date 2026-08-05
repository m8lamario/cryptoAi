# M9 Walk-Forward Validation — Initial Implementation

**Date:** 5 August 2026  
**Mode:** paper/replay only; no real trading  
**Status:** evaluation engine implemented; no production GO decision issued

## Scope

M9 introduces a deterministic walk-forward engine comparing:

- `BUY_AND_HOLD`;
- `QUANTITATIVE` using the M3 directional baseline;
- `HYBRID_AI` through an injected deterministic signal adapter.

All strategies use the same candle stream, initial capital, commission, spread, slippage, mark-to-market equity curve, and `NO_EXECUTION` policy.

## Validation controls

- Train, validation, and test windows are explicit per fold.
- Only candles available through each evaluation timestamp are passed to the quantitative signal.
- Signals are evaluated before execution on the next simulator bar.
- Replay/backtest execution policy is hard-rejected unless `NO_EXECUTION`.
- Fold results are marked out-of-sample.
- Metrics are based on simulated equity, not raw market returns.

## Metrics

The engine calculates net return, annualized return, volatility, Sharpe, Sortino, maximum drawdown, turnover, exposure time, trade count, hit rate, profit factor, average win/loss, commission, spread, slippage, AI cost, and deterministic regime returns.

## Decision policy

The initial decision is conservative:

- `GO` only when the hybrid test-fold return exceeds quantitative-only and does not increase drawdown;
- otherwise `HOLD`;
- `NO-GO` remains available for a future explicit policy when evidence demonstrates material deterioration or cost/risk harm.

This implementation does not claim alpha. A real M9 decision requires a frozen historical dataset, multiple folds, real replayed AI artifacts, and an external review of the resulting report.

## Verification

- Paper-executor typecheck/build: passed.
- Paper-executor tests: 5 passed.
- Quantitative tests: 41 passed.
- No exchange or live execution path is called by the walk-forward engine.

