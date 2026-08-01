# Migration Plan — ProjectPlan v1.3 → v1.4

**Data:** 1 Agosto 2026  
**Da:** ProjectPlan.md v1.3 (Fase 0–7 completate)  
**A:** ProjectPlan_Update_v1.4.md

---

## Stato attuale

| Fase | Stato |
|------|-------|
| Fase 0 (Fondamenta) | ✅ Completa |
| Fase 0B (Accesso proprietario) | ✅ Completa |
| Fase 1 (Pipeline dati) | ✅ Completa |
| Fase 2 (Motore quantitativo + Risk Manager) | ✅ Completa |
| Fase 2B (AI Gateway) | ✅ Completa |
| Fase 3 (Agenti AI) | ✅ Completa |
| Fase 4 (Investment Manager) | ✅ Completa |
| Fase 5 (Memoria e valutazione) | ✅ Completa |
| Fase 6 (Dashboard e notifiche) | ⚠️ Dashboard ok, Telegram non wired |
| Fase 7 (Paper trading e backtesting) | ✅ Completa |
| Fase 8 (Exchange reale) | ❌ Non iniziata |

---

## Gap v1.4

| Feature v1.4 | Stato |
|---|---|
| `TradingPlan` (SCALPING/INTRADAY/SWING/POSITION) | ✅ M1 |
| `MarketOpportunityScore` (0-100) | ✅ M1 |
| `OperatingMode` (PAPER/ASSISTED/AUTONOMOUS) | ✅ M1 |
| `AutoApprovalRule` tiered | ✅ M1 |
| `AIDecisionMemory` con checkpoint temporali | ✅ M1 |
| `MultiModelConfig` (GPT/Claude/Gemini/DeepSeek) | ✅ M1 |
| `EquitySnapshot` per grafici Dashboard 2.0 | ✅ M1 |
| Market Scanner 30-60s event-driven | ✅ M2 |
| AI Memory recording automatico (job) | ❌ M5 |
| Auto-approval rules nel Decision Gate | ❌ M4 |
| Dashboard 2.0: Hero, KPI, equity curve, timeline, grafici | ❌ M6 |
| Telegram notifications wired | ❌ M7 |
| Multi-model consensus mode | ❌ M3 |

---

## Milestone

### M1 — Contracts & Data Model ✅ COMPLETATA

**File creati:**
- `packages/contracts/src/trading-plan.ts`
- `packages/contracts/src/opportunity-score.ts`
- `packages/contracts/src/operating-mode.ts`
- `packages/contracts/src/ai-memory.ts`
- `packages/config/src/multi-model.ts`
- `packages/contracts/vitest.config.ts`
- `packages/config/vitest.config.ts`
- 5 file di test

**File modificati:**
- `packages/contracts/src/index.ts` — `tradingPlan?` in TradeProposalResponse, export nuovi moduli, tipi Dashboard 2.0
- `packages/database/prisma/schema.prisma` — `TradingPlan`, `MarketOpportunityScore`, `AIDecisionMemory`, `OperatingModeConfig`, `EquitySnapshot`
- `packages/config/src/index.ts` — export multi-model
- `packages/contracts/package.json` — zod, vitest, test script, build multi-entry
- `packages/config/package.json` — vitest, test script

**Test:** 58 nuovi test (43 contracts + 15 config), 0 regressioni.

---

### M2 — Market Opportunity Score + Event-Driven Trigger ✅ COMPLETATA

**File creati:**
- `packages/quantitative/src/opportunity-scanner.ts` — Scanner deterministico: RSI, MACD, volatilità, volume, trend, breakout → score 0-100
- `apps/worker/src/jobs/market-scanner.ts` — Job BullMQ: carica OHLCV, scansiona, persiste score, triggera AI se score ≥ threshold
- `apps/worker/src/queues/market-scanner.ts` — Queue BullMQ con retry e lock 30s
- `packages/database/src/opportunity-store.ts` — Persistenza e query `MarketOpportunityScore`
- `packages/quantitative/tests/opportunity-scanner.test.ts` — 7 test

**File modificati:**
- `packages/quantitative/src/index.ts` — Esporta `scanOpportunity`, `scanAllAssets`, `DEFAULT_SCANNER_WEIGHTS`
- `packages/database/src/index.ts` — Esporta `opportunity-store`
- `apps/worker/src/index.ts` — Aggiunto scanner ogni 60s, rimosso cron AI fisso (AI ora trigger on-demand)

**Test:** 7 nuovi test quantitative. Totale progetto: 23 file, 243 test, 0 regressioni.

---

### M3 — Multi-Model Architecture

**Da fare:**
1. `packages/ai-gateway/src/multi-model.ts` — Logica SINGLE/SECOND_OPINION/CONSENSUS
2. `apps/worker/src/jobs/ai-orchestration.ts` — Integrare la scelta del modello per ruolo dal `MultiModelConfig`
3. Test

---

### M4 — Auto-Approval Rules + Modalità Operative

**Da fare:**
1. `packages/risk-engine/src/auto-approval.ts` — Regole tiered: <1% auto, 1-3% condizionale, >3% manuale
2. `packages/risk-engine/src/operating-mode.ts` — Gate PAPER/ASSISTED/AUTONOMOUS
3. `apps/worker/src/jobs/ai-orchestration.ts` — Integrare nel flow
4. Endpoint API per leggere/scrivere modalità e regole
5. Test

---

### M5 — AI Memory (tracking 1h/6h/24h/7d/30d)

**Da fare:**
1. `apps/worker/src/jobs/memory-tracker.ts` — Job periodico che registra gli outcome ai checkpoint
2. `packages/database/src/memory-store.ts` — CRUD per `AIDecisionMemory`
3. Endpoint API per query
4. Test

---

### M6 — Dashboard 2.0 (Hero, Charts, Timeline)

**Da fare:**
1. `apps/web/components/Hero.tsx` — Valore portfolio, PnL, stato AI
2. `apps/web/components/EquityCurve.tsx` — Grafico equity
3. `apps/web/components/Timeline.tsx` — Cronologia eventi
4. `apps/web/components/AgentStatusBar.tsx` — 🟢🟡🔴 agenti
5. `apps/web/components/AiCosts.tsx` — Token e costi
6. Modificare `apps/web/app/page.tsx` per il layout Dashboard 2.0
7. Endpoint API per equity history e timeline
8. Test

---

### M7 — Wire Telegram Notifications

**Da fare:**
1. `apps/worker/src/jobs/ai-orchestration.ts` — Inviare notifiche per: proposta AMBIGUOUS, blocco Risk Manager, trade eseguito, kill switch, budget esaurito, dati scaduti
2. Test

---

## Principi

- Una milestone alla volta, attendere conferma utente prima di implementare.
- Ogni milestone deve passare: typecheck, build, test.
- Nessuna rottura delle funzionalità esistenti.
- Nessun commit automatico.
