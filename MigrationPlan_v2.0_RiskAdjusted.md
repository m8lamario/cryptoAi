# Piano di migrazione v2.0 — Risk-Adjusted Investment System

**Stato:** piano tecnico, nessuna implementazione inclusa  
**Data:** 2 agosto 2026  
**Scope:** paper trading personale, single-user, nessun trading reale  
**Riferimenti:** `ProjectPlan.md`, `ProjectPlan_Update_v1.4.md`, `ProjectPlan_Update_v1.5_MarketScanner.md`, `AuditReport_2026-08-02.md`

---

## 1. Decisione architetturale principale

L'obiettivo non deve essere aumentare il numero di agenti o il numero di chiamate OpenRouter. Deve essere massimizzare il rendimento corretto per il rischio dopo costi, slippage, drawdown e failure operativi.

La conclusione più importante è quindi negativa:

> Non esiste ancora evidenza che l'AI aggiunga alpha. Prima di espandere l'AI occorre dimostrare che dati, segnali quantitativi, sizing, esecuzione e misurazione degli outcome siano corretti.

L'architettura target deve essere:

```text
Dati freschi e point-in-time
        ↓
Universe dinamico + filtri liquidità
        ↓
Segnale quantitativo direzionale e calibrato
        ↓
Filtro rischio deterministico / portfolio construction
        ↓
AI selettiva come analista e fonte di contesto
        ↓
Manager vincolato da contratti
        ↓
Decision Gate deterministico
        ↓
Risk Manager deterministico con veto
        ↓
Executor transazionale e idempotente
        ↓
Outcome ledger + valutazione walk-forward
```

L'AI non deve diventare il componente che decide se il sistema è profittevole. Deve essere una variabile sperimentale misurabile contro baseline quantitative-only.

---

## 2. Stato reale e diagnosi critica

### 2.1 Cosa è confermato

- La pipeline end-to-end è operativa fino al paper executor.
- Il worker usa nove asset statici invece dell'universo dinamico previsto.
- In produzione live sono collegati solo Technical e Macro.
- News, Sentiment e Whale esistono come classi, ma non hanno provider live né sono integrati nell'orchestrazione.
- Il Macro Agent riceve valori `null` per tutti gli input macro principali.
- Il quorum operativo è `2`, quindi due agenti disponibili diventano artificialmente sufficienti.
- `assetExposure` viene passato al Risk Manager come `0`.
- Non esiste un cooldown effettivo per asset.
- L'RSI può risultare sempre `null` nel punto più recente per un errore di allineamento della serie.
- Lo scanner legge serie senza un controllo sufficientemente esplicito di freschezza e può selezionare record non recenti.
- Il ranking è principalmente uno score di intensità/volatilità, non una previsione direzionale calibrata del rendimento netto.
- Il paper executor non garantisce atomicità completa di ordine, posizione e saldo.
- Lo stop loss calcolato dal Risk Manager non è necessariamente persistito e applicato come comportamento operativo.
- Il `TradingPlan` previsto dai contratti non è popolato integralmente dal flusso live.
- Budget e costi AI sono prevalentemente in memoria o stimati, non un ledger contabile globale robusto.

### 2.2 Cosa l'audit non può dimostrare

- 434 cicli e circa 3,5 giorni non sono un campione valido per concludere che una strategia abbia o non abbia alpha.
- Il loss osservato non dimostra che il modello AI sia la causa principale: può derivare da sizing, stop non operativo, slippage, churn e segnali non calibrati.
- L'aumento da 2 a 5 agenti non implica un aumento del rendimento. Può aumentare correlazione degli errori, latenza, costi e superficie di failure.
- Portare l'esposizione massima dal 50% al 70–80% senza correggere sizing, correlazione e stop aumenterebbe il rischio, non necessariamente il rendimento corretto per il rischio.
- Un numero maggiore di trade non è un obiettivo valido in sé.

### 2.3 Vera gerarchia delle cause

#### Causa primaria A — Il sistema non misura correttamente il proprio processo di investimento

Se esposizione per asset, stop loss, P&L giornaliero, atomicità e outcome non sono affidabili, il sistema non può sapere se una modifica migliora il rendimento corretto per il rischio.

#### Causa primaria B — La pipeline quantitativa non produce un segnale sufficientemente valido

RSI potenzialmente nullo, dati potenzialmente stantii, score non direzionale e normalizzazioni euristiche rendono la selezione degli asset non affidabile prima ancora della fase AI.

#### Causa primaria C — Il risk layer può approvare o bloccare sulla base di stato incompleto

`assetExposure: 0`, idempotenza instabile, mancata atomicità e stop non operativo sono rischi di capitale più gravi dell'assenza dei tre agenti.

#### Causa primaria D — L'orchestrazione AI tratta copertura incompleta come consenso sufficiente

Il quorum `2/2` crea un falso senso di robustezza. L'errore è di policy e di contratto, non soltanto di prompt.

#### Causa secondaria E — Mancano dati macro/news/sentiment/on-chain utilizzabili

Questo impedisce una decisione multi-fattore, ma collegare fonti non validate prima di stabilizzare il core potrebbe peggiorare il sistema.

#### Causa secondaria F — Il Manager è sottospecificato e può appiattire i segnali

Il problema va corretto dopo aver definito un contratto decisionale completo e una baseline quantitativa. Cambiare soltanto il prompt sarebbe una modifica non falsificabile.

---

## 3. Valutazione dei problemi

Scala: **Impatto** 1–5; **costo computazionale/OpenRouter**: basso, medio, alto; **complessità**: bassa, media, alta.

| Problema | Profitto | Rischio | Qualità decisioni | Compute | OpenRouter | Complessità | Priorità |
|---|---:|---:|---:|---|---|---|---|
| Stato portfolio non atomico/idempotenza incompleta | 5 | 5 | 4 | Bassa | Nessuno | Alta | P0 |
| `assetExposure` errato | 4 | 5 | 4 | Bassa | Nessuno | Media | P0 |
| Stop loss calcolato ma non operativo | 5 | 5 | 3 | Bassa | Nessuno | Alta | P0 |
| P&L giornaliero semanticamente ambiguo | 4 | 5 | 3 | Bassa | Nessuno | Media | P0 |
| Dati stantii/serie temporali errate | 5 | 4 | 5 | Bassa | Nessuno | Media | P0 |
| RSI latest potenzialmente nullo | 3 | 3 | 4 | Bassa | Nessuno | Bassa | P0 |
| Score non direzionale e non calibrato | 5 | 4 | 5 | Media | Nessuno | Alta | P1 |
| Quorum 2/2 con agenti mancanti | 3 | 4 | 4 | Bassa | Riduzione se gate più selettivo | Media | P1 |
| Assenza cooldown/churn control | 4 | 5 | 3 | Bassa | Riduzione significativa | Media | P1 |
| Universo statico di nove asset | 2 | 3 | 3 | Media | Potenziale aumento | Media | P2 |
| Macro con input `null` | 2 | 2 | 3 | Bassa | Nessuna modifica prompt risolutiva | Media | P2 |
| Assenza News/Sentiment/Whale live | Non dimostrato | 2 | 3 | Alta | Alta | Alta | P3 |
| Manager che appiattisce i segnali | 3 | 3 | 4 | Media | Media | Alta | P2 |
| Costo AI non atomico/auditabile | 1 | 3 | 2 | Bassa | 4 | Media | P1 |
| Multi-model non operativo | Non dimostrato | 2 | 2 | Alta | Moltiplica ×2/×3 | Alta | P4 |

### Valutazione economica

Il costo osservato di circa 0,37 USD è basso in assoluto, ma inefficiente se produce quasi esclusivamente HOLD/WAIT. Con cinque asset e chiamate ogni minuto, la crescita teorica delle chiamate è incompatibile con l'idea di aggiungere semplicemente altri agenti. Il costo deve essere governato per decisione, non soltanto per mese.

Regola target: nessuna chiamata AI deve avvenire se il filtro quantitativo non ha già identificato un'opportunità direzionale, liquida, fresca e compatibile con il rischio. Second opinion e consenso devono essere eccezioni per casi ambigui o ad alto impatto.

---

## 4. Proposte architetturali

### 4.1 Stabilizzare il portfolio ledger prima dell'AI

**Perché:** un sistema che può lasciare saldo, posizione e ordine incoerenti non è valutabile e non è sicuro nemmeno in paper trading.

**Benefici:** audit affidabile, esposizione corretta, idempotenza, simulazione riproducibile, minore rischio di churn e sizing errato.

**Rischi:** migrazione Prisma e gestione dei record storici; possibile blocco temporaneo del worker durante la migrazione.

**Alternative:** serializzare tutto tramite Redis/BullMQ senza transazione DB. È più semplice, ma non protegge da crash o retry tra più operazioni persistenti; non è l'alternativa raccomandata.

### 4.2 Separare opportunity score da directional forecast

**Perché:** l'attuale score premia anche movimenti ribassisti e rialzisti come semplice intensità. Non può rappresentare direttamente rendimento atteso.

**Benefici:** ranking interpretabile, filtro BUY/SELL coerente, possibilità di calibrazione, confronto con baseline.

**Rischi:** una formula nuova può peggiorare le performance se ottimizzata sul campione storico; serve walk-forward e divieto di tuning sul periodo di audit.

**Alternative:** mantenere lo score di intensità e aggiungere un filtro direzionale deterministico separato. È l'opzione iniziale più prudente.

### 4.3 Rendere l'AI un overlay selettivo

**Perché:** non è provato che cinque agenti producano alpha; costi e latenza aumentano rapidamente.

**Benefici:** minori costi, meno failure, test A/B contro quantitative-only, AI concentrata sui casi informativi.

**Rischi:** si potrebbero scartare segnali utili; il filtro quantitativo deve essere validato e non eccessivamente restrittivo.

**Alternative:** cinque agenti su ogni asset. Non raccomandata finché non esiste evidenza che il valore marginale superi costo e rischio.

### 4.4 Non attivare fonti esterne senza qualità point-in-time

**Perché:** dati news, social e whale non timestampati, duplicati o stantii generano falsa diversificazione.

**Benefici:** report riproducibili, assenza di look-ahead, possibilità di valutare la qualità di ciascuna fonte.

**Rischi:** costi provider, rate limits, complessità operativa e dati rumorosi.

**Alternative:** lasciare gli agenti `UNAVAILABLE` fino alla disponibilità di provider validati. È preferibile a dati sintetici o mock nel flusso live.

### 4.5 Isolare l'orchestrazione in servizi di dominio

**Perché:** `ai-orchestration.ts` concentra acquisizione dati, AI, rischio, esecuzione, persistenza e notifiche in un singolo application service molto grande.

**Benefici:** test unitari e replay, backtest con stessa logica, sostituzione provider, retry per fase e osservabilità.

**Rischi:** refactoring esteso e rischio di divergenza tra live e backtest se non si condividono gli stessi contratti.

**Alternative:** mantenere il file monolitico e aggiungere test. È più veloce ma conserva accoppiamento e rende fragile ogni milestone successiva.

---

## 5. Architettura target

### 5.1 Layer di dati

- Adapter separati per market, macro, news, sentiment e on-chain.
- Ogni snapshot con timestamp di acquisizione, timestamp del dato, source, qualità e stato di freschezza.
- Nessun dato `null` trattato come HOLD: dati mancanti producono `UNAVAILABLE` per l'agente o esclusione dal percorso.
- Serie OHLCV ordinate e validate con finestra temporale esplicita.

### 5.2 Layer quantitativo

- Universo filtrato per liquidità, spread, disponibilità dati e whitelist/blacklist.
- Score di opportunità separato da direzione.
- Feature normalizzate cross-asset e per regime.
- Stima di costi, slippage e turnover prima dell'invio all'AI.
- Feature snapshot persistite per poter ricostruire ogni ranking.

### 5.3 Layer AI

- Gli agenti producono esclusivamente `AgentReport` strutturati.
- Il Manager produce esclusivamente `TradeProposal` completo.
- Quorum basato su agenti attivi e qualità dati, non su numero di risposte casualmente disponibili.
- `UNAVAILABLE` e `AMBIGUOUS` distinti da `HOLD`.
- Second opinion solo quando una policy deterministica lo richiede.

### 5.4 Layer rischio/esecuzione

- Decision Gate e Risk Manager deterministici.
- Esposizione totale, per asset, per settore/correlazione e liquidità calcolate da ledger reale.
- Stop loss e take profit persistiti e applicati da un monitor deterministico.
- Ordini, posizioni, saldo e audit trail aggiornati in una transazione coerente.
- Idempotency key stabile per decisione, non dipendente dall'orario di retry.
- Cooldown e anti-churn applicati prima del costo AI quando possibile e comunque prima dell'esecuzione.

### 5.5 Layer di valutazione

Tre strategie devono essere confrontate sullo stesso dataset e con gli stessi costi:

1. buy-and-hold;
2. quantitative-only;
3. quantitative + AI overlay.

Nessuna conclusione sull'AI deve basarsi solo su P&L assoluto. Metriche minime: return netto, volatility, Sharpe/Sortino con cautela, max drawdown, turnover, hit rate, profit factor, exposure time, costi AI, slippage, perdita per regime e stabilità out-of-sample.

---

## 6. Roadmap di migrazione

Le milestone sono separabili per deploy. Il sistema deve rimanere in paper trading e in modalità conservativa durante tutta la migrazione.

### M0 — Freeze sperimentale e baseline auditabile

**Obiettivo**

Congelare la configurazione attuale, produrre una baseline riproducibile e impedire che le metriche vengano alterate durante la migrazione.

**File interessati**

- `AuditReport_2026-08-02.md`
- `packages/database/prisma/schema.prisma`
- `packages/analytics/**`
- `apps/worker/src/jobs/**`
- `apps/api/src/**`

**Componenti coinvolti**

Worker, database, analytics, dashboard e reportistica.

**Modifiche architetturali**

- Versionare configurazione scanner, AI, rischio e fee.
- Registrare per ogni decisione input, versione del prompt, modello richiesto/reale, feature quantitative, proposta, veto e outcome.
- Separare P&L realizzato, non realizzato, giornaliero e cumulativo.
- Definire una modalità `migration-safe` che non aumenti esposizione o frequenza.

**Modifiche database**

Eventuali tabelle/versioni per configuration snapshot, decision audit e outcome ledger; non eliminare dati storici.

**Test**

Replay di una decisione storica; verifica che lo stesso input generi lo stesso ranking e che il report mostri costi e outcome coerenti.

**Criteri di completamento**

Ogni trade e ogni decisione sono ricostruibili senza log effimeri; baseline quantitative-only e AI attuale sono misurabili separatamente.

**Difficoltà:** media.  
**Dipendenze:** nessuna. È prerequisito operativo per tutte le altre milestone.

---

### M1 — Portfolio ledger transazionale e guardrail di capitale

**Obiettivo**

Eliminare incoerenze di saldo/posizione/ordine e rendere effettivi esposizione, stop e idempotenza.

**File interessati**

- `packages/paper-executor/src/executor.ts`
- `packages/risk-engine/src/risk-manager.ts`
- `packages/risk-engine/src/position-sizer.ts`
- `packages/database/prisma/schema.prisma`
- `apps/worker/src/jobs/ai-orchestration.ts`

**Componenti coinvolti**

Risk Manager, Decision Gate, Paper Executor, Prisma e worker.

**Modifiche architetturali**

- Calcolo reale di `assetExposure` dal portfolio.
- Transazione unica per fill, ordine, posizione e saldo.
- Idempotenza stabile per `proposalId`/decisione.
- Stop loss e take profit persistiti sulla posizione.
- Monitor deterministico per l'attivazione degli stop.
- Cooldown minimo temporaneo anche prima dell'implementazione completa dello scanner.

**Modifiche database**

Vincoli unici e indici per idempotency key; campi per stop/take profit, fill, fee, slippage, stato della transazione e data di apertura/chiusura. Migrazione senza perdita dei record esistenti.

**Test**

Retry dello stesso job; crash simulato in ogni passaggio; BUY su posizione esistente; limite per asset; stop raggiunto; reset P&L; due decisioni concorrenti sullo stesso asset.

**Criteri di completamento**

Nessuna esecuzione senza audit persistito; nessuna doppia esecuzione per la stessa decisione; portfolio invarianti sempre rispettate; stop realmente applicabile.

**Difficoltà:** alta.  
**Dipendenze:** M0.

---

### M2 — Correzione dati, indicatori e freshness

**Obiettivo**

Garantire che ogni segnale quantitativo usi dati recenti, ordinati e semanticamente corretti.

**File interessati**

- `packages/quantitative/src/indicators.ts`
- `packages/quantitative/src/opportunity-scanner.ts`
- `packages/quantitative/src/advanced-scanner.ts`
- `apps/worker/src/jobs/market-scanner.ts`
- `apps/worker/src/index.ts`
- `packages/market-data/src/**`

**Componenti coinvolti**

Market data collector, scanner, indicatori, database e scheduler.

**Modifiche architetturali**

- Correggere allineamento RSI e testare il valore più recente.
- Selezionare esplicitamente le ultime candele.
- Validare freshness, completezza e timeframe.
- Rifiutare snapshot troppo vecchi o incompleti.
- Persistire componenti e timestamp del punteggio.
- Distinguere dato assente da dato neutrale.

**Modifiche database**

Indici su `symbol`, `interval`, `openTime`; eventuali campi di qualità/freshness e snapshot feature.

**Test**

Test con serie note per RSI/MACD/EMA/ATR; candele fuori ordine; gap; candle vecchie; ticker senza funding/OI; determinismo del ranking.

**Criteri di completamento**

Nessun indicatore principale risulta nullo per un bug di allineamento; ogni input usato dallo scanner ha una freshness verificabile; il worker non analizza dati oltre soglia.

**Difficoltà:** media.  
**Dipendenze:** M0; può essere sviluppata in parallelo a M1 ma va attivata dopo M1 se modifica il rischio.

---

### M3 — Quantitative baseline direzionale e cost-aware

**Obiettivo**

Costruire una baseline quantitativa autonoma, interpretabile e confrontabile con l'AI.

**File interessati**

- `packages/quantitative/src/opportunity-scanner.ts`
- `packages/quantitative/src/advanced-scanner.ts`
- `packages/analytics/**`
- `packages/contracts/src/opportunity-score.ts`
- relativi test in `packages/quantitative/tests/**`

**Componenti coinvolti**

Opportunity scanner, ranking, analytics, contratti e backtest.

**Modifiche architetturali**

- Separare `opportunityIntensity`, `direction`, `expectedMove`, `expectedRisk` e `netEdge`.
- Normalizzare feature per asset e regime mediante rolling percentile/z-score, senza look-ahead.
- Penalizzare spread, slippage, fee e turnover.
- Definire soglie conservative e non ottimizzate sul periodo audit.
- Confrontare ranking con baseline buy-and-hold e quantitative-only.

**Modifiche database**

Persistenza delle feature, versione della formula, outcome a orizzonte definito e costi stimati/realizzati.

**Test**

Walk-forward; test anti-look-ahead; dataset con trend e mean reversion; asset con diversa volatilità; costi variabili; analisi per regime.

**Criteri di completamento**

La baseline è riproducibile, direzionale, cost-aware e presenta metriche out-of-sample. Non è richiesto profitto positivo immediato, ma deve superare test di coerenza e non deve dipendere da feature corrotte.

**Difficoltà:** alta.  
**Dipendenze:** M2 e M0.

---

### M4 — Scanner dinamico, anti-churn e controllo costi

**Obiettivo**

Passare dall'universo statico a un universo dinamico controllato senza esplodere in costi o turnover.

**File interessati**

- `packages/market-data/src/top-assets.ts`
- `packages/market-data/src/asset-registry.ts`
- `apps/worker/src/jobs/market-scanner.ts`
- `apps/worker/src/index.ts`
- `packages/database/prisma/schema.prisma`

**Componenti coinvolti**

Asset registry, market scanner, scheduler, BullMQ, database e budget controller.

**Modifiche architetturali**

- Refresh periodico dell'universo top 50–100.
- Whitelist, blacklist, pin, liquidità minima e disponibilità dati.
- Pipeline esplicita top 10 quantitativi → top 3–5 AI.
- Cooldown per asset dopo apertura/chiusura e anti-reentry.
- Deduplica stateful se il contesto non cambia materialmente.
- Limite giornaliero di chiamate e costo AI.

**Modifiche database**

Registry versionato, stato cooldown, ultima valutazione, motivo di esclusione e configurazione scanner.

**Test**

Refresh dell'universo; asset che entrano/escono; cooldown; duplicate job; variazione significativa che forza rivalutazione; budget massimo giornaliero.

**Criteri di completamento**

Il numero di asset e chiamate è prevedibile; nessun loop di re-entry entro cooldown; l'universo dinamico non introduce asset illiquidi o dati stantii.

**Difficoltà:** media-alta.  
**Dipendenze:** M1, M2, M3.

---

### M5 — Data layer macro/news/sentiment/on-chain

**Obiettivo**

Fornire ai cinque agenti dati reali, timestampati e valutabili, senza simulazioni nel flusso live.

**File interessati**

- `packages/market-data/src/**` nuovi adapter e normalizzatori
- `packages/agents/src/agents/macro.ts`
- `packages/agents/src/agents/news.ts`
- `packages/agents/src/agents/sentiment.ts`
- `packages/agents/src/agents/whale.ts`
- `apps/worker/src/jobs/ai-orchestration.ts`
- `packages/database/prisma/schema.prisma`

**Componenti coinvolti**

Provider data, normalizzazione, agenti e orchestrazione.

**Modifiche architetturali**

- Contratto comune per snapshot, qualità, freschezza e provenance.
- Provider macro reali prima di modificare il prompt Macro.
- News deduplicate per source ID e timestamp.
- Sentiment con campione, metodologia e qualità.
- Whale/on-chain con classificazione e limiti di affidabilità.
- Agenti mancanti attivati solo se il provider supera criteri minimi.
- Dati insufficienti → `UNAVAILABLE`, mai `HOLD`.

**Modifiche database**

Tabelle o snapshot per macro, news, sentiment, whale events, provider, timestamp e hash del contenuto normalizzato. Politica di retention esplicita.

**Test**

Provider indisponibile; dato stantio; duplicati; timezone; contenuto conflittuale; replay point-in-time; qualità insufficiente; quorum con 0–5 agenti disponibili.

**Criteri di completamento**

Ogni report live può dimostrare quali dati ha ricevuto e quando; nessun agente viene conteggiato nel quorum se i suoi dati sono indisponibili; il costo provider è misurato.

**Difficoltà:** alta.  
**Dipendenze:** M0, M2, M4; non è prerequisito per stabilizzare il core.

---

### M6 — Contratti unificati e Manager vincolato

**Obiettivo**

Eliminare disallineamenti tra contracts, agents, risk-engine e database, impedendo che il Manager appiattisca o inventi campi operativi.

**File interessati**

- `packages/contracts/src/**`
- `packages/agents/src/agents/manager.ts`
- `packages/agents/src/orchestrator.ts`
- `packages/risk-engine/src/decision-gate.ts`
- `apps/worker/src/jobs/ai-orchestration.ts`
- `packages/database/prisma/schema.prisma`

**Componenti coinvolti**

Zod contracts, agent orchestrator, Manager, Decision Gate e persistenza.

**Modifiche architetturali**

- Un'unica definizione condivisa per `AgentReport`, `TradeProposal`, `TradingPlan`, `RiskDecision` e stati `UNAVAILABLE`/`AMBIGUOUS`.
- `TradeProposal` completo: direzione, entry, stop, take profit, orizzonte, strategia, invalidazione e confidence.
- Quorum esplicito 3/5 quando cinque agenti sono realmente validi; nessun 2/2 implicito.
- Aggregazione trasparente con peso dichiarato e limite alla sovrascrittura del segnale quantitativo.
- Manager non autorizzato a modificare sizing o limiti rischio.
- Second opinion soltanto su disaccordo o soglie di materialità.

**Modifiche database**

Versione contratto, validazione fallita, report disponibili/non disponibili, proposal completa e motivazione del gate.

**Test**

BUY/SELL conflittuali; quorum insufficiente; report stantii; proposal priva di stop; confidence incoerente; Manager senza potere di esecuzione; replay deterministico.

**Criteri di completamento**

Ogni proposal è valida con lo stesso schema in worker, API, DB e test; un errore AI produce `UNAVAILABLE`; il Manager non può bypassare il Risk Manager.

**Difficoltà:** alta.  
**Dipendenze:** M3 e M5; M1 per i campi operativi di rischio.

---

### M7 — AI Gateway e cost governance

**Obiettivo**

Rendere i costi OpenRouter misurabili, limitati e proporzionati al valore informativo della decisione.

**File interessati**

- `packages/ai-gateway/src/ai-gateway.ts`
- `packages/ai-gateway/src/budget-tracker.ts`
- `packages/ai-gateway/src/openrouter-provider.ts`
- `packages/ai-gateway/src/multi-model.ts`
- `packages/database/prisma/schema.prisma`
- `apps/worker/src/jobs/ai-orchestration.ts`

**Componenti coinvolti**

Gateway, provider, retry, circuit breaker, ledger AI e worker.

**Modifiche architetturali**

- Ledger persistente per chiamata, retry, token, modello richiesto/reale e costo stimato/reale.
- Budget atomico per ciclo, giorno, asset, agente e modello.
- Token budget per prompt e contesto deduplicato.
- Retry con policy esplicita e contabilizzazione corretta.
- Multi-model solo per casi selezionati, non come default.
- Stop automatico quando il costo marginale supera il valore atteso del trade.

**Modifiche database**

AI call ledger, budget reservation, provider response metadata e policy version.

**Test**

Chiamate concorrenti; 402/429/5xx/timeout; fallback; actual model diverso; retry; superamento budget; duplicate context; consensus 2/3.

**Criteri di completamento**

Il costo giornaliero è bounded e verificabile; ogni costo è attribuibile a una decisione; nessuna retry storm può superare il budget.

**Difficoltà:** media-alta.  
**Dipendenze:** M0 e M4; indipendente dall'attivazione dei cinque agenti.

---

### M8 — Refactoring dell'orchestrazione e replay comune

**Obiettivo**

Scomporre il job monolitico e usare gli stessi servizi di dominio in live, test e backtest.

**File interessati**

- `apps/worker/src/jobs/ai-orchestration.ts`
- `apps/worker/src/jobs/market-scanner.ts`
- `apps/worker/src/jobs/memory-tracker.ts`
- nuovi moduli applicativi sotto `apps/worker/src/` o package condivisi
- `packages/analytics/**`

**Componenti coinvolti**

Workflow coordinator, data snapshot service, signal service, AI service, decision service, execution service, outcome service.

**Modifiche architetturali**

Separare:

1. acquisizione e validazione dati;
2. ranking quantitativo;
3. raccolta report AI;
4. aggregazione proposal;
5. Decision Gate;
6. Risk Manager;
7. execution transaction;
8. outcome/memory e notifiche.

Ogni fase deve avere input/output contrattuali e retry isolato. L'esecuzione non deve ripartire automaticamente da una fase precedente senza idempotenza.

**Modifiche database**

Workflow run, phase status, correlation ID, retry state e snapshot references.

**Test**

Replay completo; retry per singola fase; failure provider; failure DB; duplicate worker; equivalenza live/backtest sui medesimi snapshot.

**Criteri di completamento**

Nessuna decisione critica dipende da `try/catch` best-effort; il workflow è osservabile per fase; backtest e live condividono la logica di dominio.

**Difficoltà:** alta.  
**Dipendenze:** M1, M2, M6, M7.

---

### M9 — Validazione walk-forward e decisione di go/no-go

**Obiettivo**

Determinare se l'AI aggiunge valore netto e se la baseline è abbastanza robusta per continuare la sperimentazione.

**File interessati**

- `packages/analytics/**`
- `packages/paper-executor/src/backtest.ts`
- test di integrazione in `apps/worker/tests/**`
- report tecnici versionati fuori da `ProjectPlan.md`

**Componenti coinvolti**

Backtest, analytics, paper executor, data snapshots e dashboard.

**Modifiche architetturali**

- Walk-forward con finestre train/validation/test.
- Baseline buy-and-hold, quantitative-only e quantitative+AI.
- Commissioni, slippage, latenza, turnover e costi OpenRouter inclusi.
- Analisi per asset, regime, agente e modello.
- Blocco di qualunque passaggio a trading reale.

**Modifiche database**

Dataset/versioni di backtest, run metrics, parameter set, prompt version e risultati out-of-sample.

**Test**

No look-ahead; dati mancanti; crash; alta volatilità; gap; provider AI indisponibile; cost ceiling; confronto statistico prudente.

**Criteri di completamento**

Esiste una decisione documentata:

- **GO sperimentale:** AI overlay mostra beneficio netto stabile rispetto alla baseline e senza peggiorare drawdown oltre soglia;
- **NO-GO:** AI non dimostra valore o aumenta costo/turnover/rischio;
- **HOLD:** dati insufficienti, senza modificare aggressivamente la strategia.

Nessuna decisione può basarsi sul solo profitto di pochi giorni.

**Difficoltà:** alta.  
**Dipendenze:** tutte le precedenti, in particolare M3 e M8.

---

## 7. Ordine corretto di implementazione

1. **M0:** baseline e audit trail.
2. **M1:** ledger, esposizione, stop, atomicità e idempotenza.
3. **M2:** freshness e indicatori.
4. **M3:** baseline quantitativa direzionale e cost-aware.
5. **M4:** universo dinamico, cooldown e controllo del costo.
6. **M7:** governance OpenRouter; può procedere in parallelo dopo M0/M4.
7. **M5:** fonti reali per gli agenti mancanti.
8. **M6:** contratti e Manager vincolato.
9. **M8:** refactoring dell'orchestrazione.
10. **M9:** validazione walk-forward e go/no-go.

L'attivazione di News, Sentiment e Whale prima di M1–M4 è sconsigliata: aggiungere informazione a un sistema che misura male il rischio rende più difficile identificare la causa dei risultati.

---

## 8. Criteri di successo globali

Il progetto non deve dichiararsi migliorato perché produce più BUY o più trade. I criteri globali sono:

- zero esecuzioni non idempotenti;
- zero portfolio state incoerenti dopo retry/crash test;
- stop e limiti di esposizione realmente applicati;
- freshness e provenance disponibili per ogni input;
- baseline quantitativa riproducibile;
- costo OpenRouter bounded e attribuibile;
- turnover e churn sotto soglie configurate;
- confronto out-of-sample con baseline;
- drawdown, volatilità e perdita giornaliera monitorabili con semantica unica;
- AI classificata come valore aggiunto solo se migliora rendimento netto corretto per rischio, non se aumenta il numero di segnali.

## 9. Decisioni da non prendere ora

- Non aumentare la max portfolio exposure al 70–80% sulla base dell'audit.
- Non cambiare solo i prompt di Macro o Manager.
- Non attivare agenti con dati simulati o provider non validati.
- Non introdurre multi-model consensus come default.
- Non ampliare l'universo a 50–100 asset prima di avere cooldown, budget e ranking affidabili.
- Non usare il paper P&L di 3,5 giorni come prova di validità o invalidità della strategia.
- Non modificare `ProjectPlan.md` durante questa migrazione senza una decisione architetturale esplicita e versionata.

## 10. Conclusione

Il problema principale non è che il sistema abbia soltanto due agenti. Il problema è che il sistema sta attribuendo un ruolo decisionale a un layer AI sopra una base quantitativa, di rischio e di persistenza non ancora sufficientemente affidabile.

La migrazione deve quindi seguire il principio:

> prima rendere il sistema misurabile e sicuro, poi rendere il segnale quantitativo valido, infine verificare se l'AI aggiunge valore.

Se l'AI non supera la baseline dopo questa procedura, la decisione corretta non è aggiungere altri agenti: è ridurre l'AI a overlay opzionale oppure rimuoverla dal percorso di trading e conservarla per analisi, ranking qualitativo e ricerca.

