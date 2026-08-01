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
| AI Memory recording automatico (job) | ✅ M5 |
| Auto-approval rules nel Decision Gate | ✅ M4 |
| Dashboard 2.0: Hero, KPI, equity curve, timeline, grafici | ❌ M6 |
| Telegram notifications wired | ❌ M7 |
| Multi-model consensus mode | ✅ M3 |

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

### M3 — Multi-Model Architecture ✅ COMPLETATA

**File creati:**
- `packages/ai-gateway/src/multi-model.ts` — `MultiModelGateway` con 3 strategie: `SINGLE`, `SECOND_OPINION` (agreement flag), `CONSENSUS` (majority/blocking)
- `packages/ai-gateway/tests/multi-model.test.ts` — 10 test

**File modificati:**
- `packages/ai-gateway/src/index.ts` — Esporta `MultiModelGateway`, `MultiModelConfig`, `MultiModelEntry`, `ConsensusMode`
- `apps/worker/src/jobs/ai-orchestration.ts` — Importa `DEFAULT_MULTI_MODEL_CONFIG`, `getRoleConfig`, `validateModelDiversity` da `@cryptoai/config` per guida modello per ruolo

**Test:** 10 nuovi test ai-gateway. Totale progetto: 24 file, 253 test, 0 regressioni.

---

### M4 — Auto-Approval Rules + Modalità Operative ✅ COMPLETATA

**File creati:**
- `packages/risk-engine/src/auto-approval.ts` — `evaluateAutoApproval()`: regole tiered (<1% AUTO, 1-3% condizionale, >3% manuale, >5% blocked). PAPER always EXECUTES, ASSISTED holds for confirmation, AUTONOMOUS follows rules
- `packages/risk-engine/src/operating-mode.ts` — In-memory state: `getOperatingMode()`, `setOperatingMode()`, `getAutoApprovalRules()`, `setAutoApprovalRules()`
- `apps/api/src/routes/operating-mode.ts` — Endpoint REST: `GET /operating-mode`, `PUT /operating-mode/mode`, `PUT /operating-mode/rules` con persistenza DB
- `packages/risk-engine/tests/auto-approval.test.ts` — 11 test

**File modificati:**
- `packages/risk-engine/src/index.ts` — Esporta `evaluateAutoApproval`, `AutoApprovalInput/Result`, `OperatingMode`, `initOperatingMode`, `get/setOperatingMode`, `get/setAutoApprovalRules`
- `apps/api/src/app.ts` — Monta `createOperatingModeRouter()` su `/operating-mode`
- `apps/api/package.json` — Aggiunto `@cryptoai/risk-engine`

**Test:** 11 nuovi test risk-engine. Totale progetto: 25 file, 264 test, 0 regressioni.

---

### M5 — AI Memory (tracking 1h/6h/24h/7d/30d) ✅ COMPLETATA

**File creati:**
- `packages/database/src/memory-store.ts` — CRUD: `storeDecisionMemory()`, `addMemoryOutcome()`, `finalizeDecisionMemory()`, `findPendingCheckpoints()`, `getDecisionMemories()`
- `apps/worker/src/jobs/memory-tracker.ts` — Job periodico: per ogni checkpoint scaduto, recupera prezzo corrente, calcola P&L, registra outcome, finalizza dopo AFTER_30D
- `apps/worker/src/queues/memory-tracker.ts` — Queue BullMQ con retry e lock 120s
- `apps/api/src/routes/ai-memory.ts` — Endpoint `GET /ai-memory` per query decision memories

**File modificati:**
- `packages/database/src/index.ts` — Esporta `memory-store`
- `apps/worker/src/index.ts` — Aggiunto memory tracker ogni 15 minuti
- `apps/worker/src/jobs/ai-orchestration.ts` — Chiama `storeDecisionMemory()` dopo ogni trade eseguito (BUY e SELL) con indicatori, modello, confidence
- `apps/api/src/app.ts` — Monta `createAiMemoryRouter()` su `/ai-memory`

**Test:** Funzionalità verificata con typecheck + test esistenti (0 regressioni su 264 test). Totale progetto: persistente invariato.

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
