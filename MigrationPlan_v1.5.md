# Migration Plan — ProjectPlan v1.4 → v1.5

**Data:** 1 Agosto 2026
**Da:** ProjectPlan.md v1.4 (MigrationPlan_v1.4.md M1–M7 completate)
**A:** ProjectPlan_Update_v1.5_MarketScanner.md

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
| Fase 6 (Dashboard e notifiche) | ✅ Completa |
| Fase 7 (Paper trading e backtesting) | ✅ Completa |
| Fase 8 (Exchange reale) | ❌ Non iniziata |
| **v1.5 Market Scanner** | 🔄 Da implementare |

### Fondamenta già esistenti (riutilizzabili)

| Componente | File | Stato |
|---|---|---|
| Opportunity Scanner deterministico | `packages/quantitative/src/opportunity-scanner.ts` | ✅ Esistente (RSI, MACD, volatilità, volume, trend, breakout) |
| Job scanner BullMQ | `apps/worker/src/jobs/market-scanner.ts` | ✅ Esistente (ogni 60s, 100 candele) |
| Queue scanner | `apps/worker/src/queues/market-scanner.ts` | ✅ Esistente |
| Modello Prisma | `MarketOpportunityScore` in `schema.prisma` | ✅ Esistente |
| Store persistenza | `packages/database/src/opportunity-store.ts` | ✅ Esistente |
| Contratti tipi/threshold | `packages/contracts/src/opportunity-score.ts` | ✅ Esistente |
| Provider Binance | `packages/market-data/src/binance.ts` | ✅ Esistente (API pubbliche illimitate) |
| Dashboard generica | `apps/web/app/page.tsx` | ✅ Esistente (8 tab) |
| Notifiche Telegram | `apps/worker/src/jobs/` | ✅ Esistente (8 eventi già wired) |

---

## Gap v1.5

| Feature v1.5 | Stato |
|---|---|
| Watchlist fissa a 3 asset (BTC, ETH, SOL) | ❌ Da espandere a 50-100 |
| Asset intermedi (BNB, XRP, LINK, SUI, AVAX, DOGE) | ❌ Non presenti |
| Collegamento scanner → AI orchestration | ❌ `aiTriggered: true` senza enqueue |
| Scanner avanzato (funding rate, open interest, whale, sentiment) | ❌ Solo 6 metriche deterministiche |
| Configurazione scanner (soglie, frequenza, max asset) | ❌ Hardcoded |
| Whitelist/blacklist dinamica | ❌ Non esiste |
| Filtro liquidità (pre-scoring) | ❌ Non implementato |
| Pipeline decisionale completa | ❌ Parziale (scanner sì, catena no) |
| Dashboard Opportunity Ranking | ❌ Non esiste |
| Dashboard Heatmap Mercato | ❌ Non esiste |
| Dashboard Watchlist Dinamica | ❌ Non esiste |
| Endpoint REST scanner config | ❌ Non esiste |
| Endpoint REST opportunity scores | ❌ Non esiste |

---

## Milestone

### M1 — Espansione Asset List + Raccolta Dati Multi-Asset

**Obiettivo:** passare da 3 asset hardcoded a 50+ asset configurabili con raccolta dati.

**Attività:**

1. **Asset Registry configurabile**
   - File: `packages/market-data/src/asset-registry.ts` (nuovo)
   - Estrae `SUPPORTED_ASSETS` da `types.ts` in un registry interrogabile
   - Carica asset da configurazione (env o file JSON), non hardcoded
   - Include asset MVP (BTC, ETH, SOL) + intermedi (BNB, XRP, LINK, SUI, AVAX, DOGE)
   - Supporta query per market cap, volume, symbol
   - Test: caricamento da config, fallback default, validazione simboli

2. **Binance top assets fetcher**
   - File: `packages/market-data/src/top-assets.ts` (nuovo)
   - Chiama endpoint pubblici Binance per recuperare top N asset per volume/market cap
   - Restituisce lista simboli USDT con metadati (market cap approssimato via ticker)
   - Test: mock HTTP, parsing risposta, filtro stablecoin e pair non-USDT

3. **Market data collection multi-asset**
   - Modifica: `apps/worker/src/jobs/market-data-collection.ts`
   - Itera su tutti gli asset del registry (non solo 3)
   - Rate limiting rispettoso dei limiti Binance (1200 req/min)
   - Batch fetching candele per asset multipli
   - Test: verifica raccolta per N asset, rate limit handling

4. **Aggiornamento Prisma schema**
   - Modifica: `packages/database/prisma/schema.prisma`
   - Nuovo modello `AssetConfig` (whitelist, blacklist, pinned, maxCapital)
   - Nuovo modello `ScannerConfig` (threshold, maxAssets, frequency, enabledMetrics)
   - Nuovo modello `MarketAsset` (symbol, baseAsset, quoteAsset, name, marketCap, isActive)
   - Migration Prisma

5. **Store persistenza configurazioni**
   - File: `packages/database/src/scanner-config-store.ts` (nuovo)
   - CRUD per `ScannerConfig` e `AssetConfig`
   - Funzioni: `getScannerConfig()`, `updateScannerConfig()`, `getActiveAssets()`, `getAssetConfig()`, `setAssetConfig()`
   - Test: creazione, update, query con filtri

**File da creare:**
- `packages/market-data/src/asset-registry.ts`
- `packages/market-data/src/top-assets.ts`
- `packages/database/src/scanner-config-store.ts`

**File da modificare:**
- `packages/market-data/src/types.ts` — rimuove `SUPPORTED_ASSETS` hardcoded, importa da registry
- `packages/market-data/src/index.ts` — esporta nuovi moduli
- `apps/worker/src/jobs/market-data-collection.ts` — multi-asset
- `packages/database/prisma/schema.prisma` — nuovi modelli
- `packages/database/src/index.ts` — esporta scanner-config-store

**Criterio di completamento:**
- Almeno 9 asset raccolgono candele ogni 15 minuti
- L'asset list non è più hardcoded
- Typecheck, lint, test passano (0 regressioni)

---

### M2 — Scanner Avanzato con Metriche Estese

**Obiettivo:** arricchire lo scanner deterministico con tutte le metriche previste dal v1.5.

**Attività:**

1. **Filtro liquidità pre-scoring**
   - File: `packages/quantitative/src/liquidity-filter.ts` (nuovo)
   - Filtra asset per: volume 24h minimo, market cap minimo, spread bid/ask
   - Restituisce solo asset che superano le soglie
   - Test: filtraggio con soglie diverse, edge case (0 volume, market cap null)

2. **Metriche scanner aggiuntive**
   - File: `packages/quantitative/src/advanced-scanner.ts` (nuovo)
   - Aggiunge al `scanOpportunity` esistente:
     - **Funding Rate** (da Binance `/fapi/v1/fundingRate`) — peso 0.05
     - **Open Interest** (da Binance `/fapi/v1/openInterest`) — peso 0.05
     - **Price Change %** (1h, 4h, 24h) — peso 0.10
     - **Volume/Market Cap ratio** — già coperto da volume, raffinamento
   - I pesi vengono ricalibrati: RSI 0.18, MACD 0.18, Volatilità 0.12, Volume 0.12, Trend 0.15, Breakout 0.10, Funding 0.05, OI 0.05, PriceChange 0.05
   - Test: calcolo funding rate, OI change, price momentum

3. **Nuovi data fetcher per metriche futures**
   - File: `packages/market-data/src/futures-data.ts` (nuovo)
   - Recupera funding rate e open interest da Binance Futures (endpoint pubblici)
   - Cache per evitare chiamate duplicate
   - Fallback graceful se futures non disponibili per un asset
   - Test: mock HTTP, parsing, fallback

4. **Aggiornamento scanner job**
   - Modifica: `apps/worker/src/jobs/market-scanner.ts`
   - Integra filtro liquidità prima dello scoring
   - Recupera futures data per metriche aggiuntive
   - Gestisce asset senza futures (score ridotto, non bloccante)
   - Test: integrazione con liquidity filter, futures data opzionali

5. **Classificazione a 4 tier già esistente** (verifica e test)
   - Modifica: `packages/contracts/src/opportunity-score.ts`
   - Aggiunge tier `QUANTITATIVE_ANALYSIS` (60-80) mancante
   - Aggiorna soglie: IGNORE (0-30), MONITORING (30-60), QUANTITATIVE (60-80), AI_ANALYSIS (80-100)
   - Test: classificazione boundary

**File da creare:**
- `packages/quantitative/src/liquidity-filter.ts`
- `packages/quantitative/src/advanced-scanner.ts`
- `packages/market-data/src/futures-data.ts`

**File da modificare:**
- `packages/quantitative/src/opportunity-scanner.ts` — integra nuove metriche
- `packages/quantitative/src/index.ts` — esporta nuovi moduli
- `packages/contracts/src/opportunity-score.ts` — aggiungi tier QUANTITATIVE_ANALYSIS
- `apps/worker/src/jobs/market-scanner.ts` — liquidity filter + advanced metrics
- `packages/market-data/src/index.ts` — esporta futures-data

**Criterio di completamento:**
- Scanner produce score 0-100 per 50+ asset
- Filtro liquidità esclude asset sotto soglia
- Funding rate e OI contribuiscono allo score
- Typecheck, lint, test passano (0 regressioni)

---

### M3 — Pipeline Decisionale Completa (Wiring)

**Obiettivo:** collegare l'intera catena: Scanner → Filtro → Score → Top N → AI → Manager → Risk.

**Attività:**

1. **Collegamento scanner → AI orchestration**
   - Modifica: `apps/worker/src/jobs/market-scanner.ts`
   - Dopo lo scoring, seleziona top N asset (configurabile, default 3-5) con score ≥ soglia AI
   - Per ogni asset triggerato, enqueue job `ai-orchestration` con `{ asset, score, components }`
   - Deduplica: non ri-enqueue se già in elaborazione per lo stesso asset
   - Test: enqueue condizionale, deduplica

2. **Pipeline orchestrator**
   - File: `apps/worker/src/jobs/pipeline-orchestrator.ts` (nuovo)
   - Orchestratore centrale che gestisce il flusso:
     1. Esegue scanner su tutti gli asset
     2. Applica liquidity filter
     3. Calcola scores
     4. Seleziona top 10 per analisi quantitativa approfondita
     5. Da top 10, seleziona top 3-5 per AI
     6. Triggera AI orchestration per i top 3-5
   - Nella versione iniziale: combina step 1-4 in un unico job sequenziale
   - Test: flusso completo con mock, selezione top N

3. **AI orchestration asset-aware**
   - Modifica: `apps/worker/src/jobs/ai-orchestration.ts`
   - Accetta parametro `asset` dal job data
   - Esegue agenti AI solo per l'asset specificato (non tutti gli asset)
   - Calcola costo AI stimato prima di eseguire
   - Test: orchestration per singolo asset, skip se budget esaurito

4. **Configurazione pipeline**
   - Modifica: `packages/config/src/scanner-config.ts` (nuovo)
   - Valori di default:
     - `maxAssetsToScan`: 100
     - `maxAssetsForQuant`: 10
     - `maxAssetsForAI`: 5
     - `minScoreForAI`: 60
     - `scannerFrequencyMinutes`: 15
     - `minVolume24hUsd`: 1_000_000
     - `minMarketCapUsd`: 10_000_000
   - Caricamento da env con fallback
   - Test: validazione Zod, valori default

**File da creare:**
- `apps/worker/src/jobs/pipeline-orchestrator.ts`
- `packages/config/src/scanner-config.ts`

**File da modificare:**
- `apps/worker/src/jobs/market-scanner.ts` — accoda AI orchestration
- `apps/worker/src/jobs/ai-orchestration.ts` — asset-aware, riceve `asset` parametro
- `apps/worker/src/index.ts` — sostituisce cron market-scanner con pipeline-orchestrator
- `packages/config/src/index.ts` — esporta scanner-config

**Criterio di completamento:**
- Pipeline end-to-end: scanner → filtro → score → top N → AI trigger
- AI analizza solo asset con score elevato
- La catena è osservabile via log
- Typecheck, lint, test passano (0 regressioni)

---

### M4 — API Scanner Configuration & Opportunity Scores

**Obiettivo:** esporre endpoint REST per configurare lo scanner e consultare gli score.

**Attività:**

1. **Endpoint configurazione scanner**
   - File: `apps/api/src/routes/scanner-config.ts` (nuovo)
   - `GET /scanner/config` — restituisce configurazione corrente
   - `PUT /scanner/config` — aggiorna configurazione (maxAssets, thresholds, frequenza)
   - Validazione Zod della configurazione
   - Persistenza tramite `scanner-config-store`
   - Test: lettura, scrittura, validazione, valori fuori range

2. **Endpoint opportunity scores**
   - File: `apps/api/src/routes/opportunity-scores.ts` (nuovo)
   - `GET /opportunity-scores` — restituisce ranking corrente (top N, ordinato per score)
   - `GET /opportunity-scores/:asset` — storico score per asset (ultime 24h/7d/30d)
   - Query parameter: `limit`, `minScore`, `classification`
   - Test: ranking, storico, filtri

3. **Endpoint asset watchlist**
   - File: `apps/api/src/routes/watchlist.ts` (nuovo)
   - `GET /watchlist` — restituisce configurazione corrente (whitelist, blacklist, pinned)
   - `PUT /watchlist/assets/:asset` — aggiorna stato asset (pinned, excluded, maxCapital)
   - `POST /watchlist/refresh` — forza refresh lista asset da exchange
   - Test: CRUD configurazioni, refresh

4. **Montaggio route in app.ts**
   - Modifica: `apps/api/src/app.ts`
   - Monta `createScannerConfigRouter()` su `/scanner/config`
   - Monta `createOpportunityScoresRouter()` su `/opportunity-scores`
   - Monta `createWatchlistRouter()` su `/watchlist`
   - Tutti con `requireAuth`

**File da creare:**
- `apps/api/src/routes/scanner-config.ts`
- `apps/api/src/routes/opportunity-scores.ts`
- `apps/api/src/routes/watchlist.ts`

**File da modificare:**
- `apps/api/src/app.ts` — monta 3 nuovi router

**Criterio di completamento:**
- Configurazione scanner leggibile e modificabile via API
- Ranking opportunità consultabile con storico
- Watchlist configurabile (pin/escludi)
- Typecheck, lint, test passano (0 regressioni)

---

### M5 — Dashboard v1.5: Opportunity Ranking, Heatmap e Watchlist

**Obiettivo:** aggiungere le 3 nuove sezioni dashboard previste dal v1.5.

**Attività:**

1. **Opportunity Ranking component**
   - File: `apps/web/components/OpportunityRanking.tsx` (nuovo)
   - Tabella ordinabile: rank, asset, score (con barra progresso), variazione 24h, classificazione (badge colorato)
   - Highlight per score ≥ 80 (AI analysis) e ≥ 60 (quantitative)
   - Colori: IGNORE (grigio), MONITORING (giallo), QUANTITATIVE (blu), AI_ANALYSIS (verde), MAX_PRIORITY (oro)
   - Paginazione o scroll per N asset
   - Aggiornamento automatico (polling 30s)

2. **Market Heatmap component**
   - File: `apps/web/components/MarketHeatmap.tsx` (nuovo)
   - Griglia heatmap: ogni cella = un asset
   - Dimensioni cella proporzionali al market cap (o volume)
   - Colore: trend (verde positivo, rosso negativo, intensità = forza)
   - Tooltip: asset, prezzo, variazione 24h, score, volume
   - Layout responsive (3-5 colonne)
   - Dati da `GET /opportunity-scores` + `GET /market-data/latest`

3. **Watchlist Dinamica component**
   - File: `apps/web/components/DynamicWatchlist.tsx` (nuovo)
   - Lista asset con: simbolo, nome, score, stato (pinned/escluso/attivo)
   - Azioni rapide: pin/unpin, escludi/includi
   - Whitelist/blacklist inline editing
   - Input per max capital per asset
   - Chiamate a `PUT /watchlist/assets/:asset`

4. **Nuovo tab "Scanner" nella Sidebar**
   - Modifica: `apps/web/components/Sidebar.tsx`
   - Aggiunge nono tab: "Scanner" con icona radar/target
   - Contiene 3 sotto-sezioni: Opportunity Ranking, Heatmap, Watchlist

5. **ScannerTab container**
   - File: `apps/web/components/tabs/ScannerTab.tsx` (nuovo)
   - Layout: OpportunityRanking (top) + MarketHeatmap (middle) + DynamicWatchlist (bottom)
   - Fetch data da nuovi endpoint API

6. **Aggiornamento pagina principale**
   - Modifica: `apps/web/app/page.tsx`
   - Aggiunge tab "scanner" alla lista tab
   - Renderizza `ScannerTab` quando `activeTab === 'scanner'`

7. **Proxy API per nuovi endpoint**
   - File: `apps/web/app/api/scanner/config/route.ts` (nuovo)
   - File: `apps/web/app/api/opportunity-scores/route.ts` (nuovo)
   - File: `apps/web/app/api/watchlist/route.ts` (nuovo)
   - Stesso pattern proxy esistente: forward cookie a API backend

8. **Aggiornamento tipi Dashboard**
   - Modifica: `apps/web/app/types.ts`
   - Aggiunge `opportunityScores`, `scannerConfig`, `watchlist` al `DashboardData`
   - Importa tipi da `@cryptoai/contracts`

**File da creare:**
- `apps/web/components/OpportunityRanking.tsx`
- `apps/web/components/MarketHeatmap.tsx`
- `apps/web/components/DynamicWatchlist.tsx`
- `apps/web/components/tabs/ScannerTab.tsx`
- `apps/web/app/api/scanner/config/route.ts`
- `apps/web/app/api/opportunity-scores/route.ts`
- `apps/web/app/api/watchlist/route.ts`

**File da modificare:**
- `apps/web/components/Sidebar.tsx` — aggiungi tab "Scanner"
- `apps/web/app/page.tsx` — aggiungi tab scanner
- `apps/web/app/types.ts` — estendi DashboardData

**Criterio di completamento:**
- Ranking opportunità visibile con score e classificazione
- Heatmap mostra trend/volatilità/momentum
- Watchlist modificabile (pin/escludi/max capital)
- Dashboard accessibile solo da rete autorizzata
- Typecheck, lint, build passano

---

### M6 — Configurazione e Messa a Punto

**Obiettivo:** rendere ogni aspetto dello scanner configurabile e validare la pipeline end-to-end.

**Attività:**

1. **Configurazione da dashboard**
   - Widget di configurazione nello ScannerTab
   - Modifica numero max asset, soglie, frequenza scanner
   - Validazione lato client (Zod) e server
   - Persistenza immediata
   - Test: modifica config, verifica effetto sul ciclo successivo

2. **Notifiche Telegram per scanner**
   - Modifica: eventi scanner notificabili
   - `SCANNER_TOP_OPPORTUNITY` — quando un asset raggiunge score ≥ 80
   - `SCANNER_NO_OPPORTUNITIES` — quando nessun asset supera la soglia AI
   - `SCANNER_ERROR` — errore nel ciclo scanner
   - Test: verifica invio notifiche per ogni evento

3. **Validazione end-to-end**
   - Test di integrazione: scanner → filtro → score → top N → AI trigger
   - Verifica con dati reali: almeno 50 asset scansionati
   - Verifica performance: scanner completo in < 30 secondi
   - Verifica costi: AI chiamata solo per top 3-5 asset
   - Test: integrazione con mock provider

4. **Documentazione**
   - Aggiornamento README con nuova architettura multi-asset
   - Documentazione configurazione scanner
   - Esempi di utilizzo dashboard scanner

**File da creare:**
- `apps/web/components/ScannerConfig.tsx` (nuovo)

**File da modificare:**
- `apps/worker/src/jobs/pipeline-orchestrator.ts` — integra notifiche
- `apps/web/components/tabs/ScannerTab.tsx` — aggiungi config widget
- `README.md` — documentazione

**Criterio di completamento (da ProjectPlan_Update_v1.5):**
- ✅ Lo scanner analizza almeno 50 asset
- ✅ Il ranking viene aggiornato automaticamente
- ✅ Gli agenti AI analizzano solo gli asset prioritari
- ✅ La dashboard mostra chiaramente le migliori opportunità del momento
- ✅ Il sistema mantiene tempi di risposta e costi prevedibili

---

## Riepilogo Milestone

| Milestone | Descrizione | File nuovi | File modificati |
|-----------|-------------|------------|-----------------|
| **M1** | Espansione Asset List + Raccolta Multi-Asset | 3 | 5 |
| **M2** | Scanner Avanzato con Metriche Estese | 3 | 5 |
| **M3** | Pipeline Decisionale Completa (Wiring) | 2 | 3 |
| **M4** | API Scanner Config & Opportunity Scores | 3 | 1 |
| **M5** | Dashboard v1.5: Ranking, Heatmap, Watchlist | 7 | 3 |
| **M6** | Configurazione, Notifiche, Validazione | 1 | 3 |
| **Totale** | | **19** | **20** |

---

## Principi

- Una milestone alla volta, attendere conferma utente prima di implementare.
- Ogni milestone deve passare: typecheck, build, test (0 regressioni).
- Nessuna rottura delle funzionalità esistenti.
- Nessun commit automatico.
- I dati devono essere reali (Binance API pubbliche).
- Nessun ordine reale.
- L'AI Gateway rimane l'unico punto di accesso ai modelli.
- Il Risk Manager mantiene potere di veto assoluto.
- La dashboard rimane accessibile solo da rete autorizzata.

---

## Rischi

| Rischio | Mitigazione |
|---------|-------------|
| Rate limiting Binance su 50+ asset | Batch fetching, caching, frequenza scanner configurabile |
| Aumento costo AI (più asset = più chiamate) | Pipeline filtra a top 3-5, soglia score configurabile |
| Performance scanner su 100 asset | Calcolo puramente deterministico, nessuna chiamata AI nello scanner |
| Futures non disponibili per tutti gli asset | Fallback graceful, peso ridotto delle metriche futures |
| Complessità dashboard | Componenti separati, tab dedicato "Scanner" |

