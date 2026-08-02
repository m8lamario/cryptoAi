# System Audit Report — 2 Agosto 2026

**Versione:** 1.0
**Data:** 2 agosto 2026
**Sistema:** cryptoAi v2.0 — Paper Trading su mini PC N100
**Periodo analizzato:** 30 luglio – 2 agosto 2026 (434 cicli AI, ~3.5 giorni)

---

## 1. Executive Summary

Il sistema è tecnicamente funzionante (pipeline completa da scanner a paper executor), ma **non sta producendo risultati finanziari validi**. Su 434 cicli AI completi, solo 7 ordini sono stati eseguiti, con una perdita netta realizzata di **-$140 USDT** (-1.4% su capitale iniziale di 10,000 USDT). Il costo AI è stato di **$0.37** in 3 giorni.

La causa principale è che gli agenti AI producono segnali quasi esclusivamente `HOLD`/`WAIT` con score ~0.00, e solo 2 dei 5 agenti previsti sono attivi (Technical + Macro).

---

## 2. Stato del sistema

### 2.1 Infrastruttura

| Componente | Stato | Dettaglio |
|---|---|---|
| PostgreSQL 16 | ✅ Attivo | 24 tabelle, 10 migration applicate |
| Redis 7 | ✅ Attivo | Coda BullMQ operativa |
| API (Express) | ✅ Attivo | Porta configurata, tsx watch |
| Worker (BullMQ) | ✅ Attivo | 6 code configurate, tsx watch |
| Dashboard (Next.js) | ✅ Attivo | Porta 3001, accessibile |
| OpenRouter | ✅ Attivo | Chiamate reali con `deepseek-v4-pro` |

### 2.2 Pipeline

```
Market Scanner (60s) → Indicatori Tecnici → Technical Agent + Macro Agent
                                                      ↓
                                               Manager Agent
                                                      ↓
                                              Decision Gate
                                                      ↓
                                              Risk Manager
                                                      ↓
                                             Paper Executor
```

Tutti i job sono in esecuzione regolare. Nessun errore di sistema rilevato.

### 2.3 Saldo e Performance

| Metrica | Valore |
|---|---|
| Capitale iniziale | 10,000.00 USDT |
| Saldo liquido attuale | 6,897.20 USDT |
| Equity totale (saldo + posizioni) | ~9,860 USDT |
| Peak value | 10,000.00 USDT |
| Daily PnL | +3.20 USDT |
| Perdita realizzata cumulativa | -$140.29 USDT (-1.40%) |
| Posizione aperta | BNBUSDT LONG 5.03 @ 588.38 (PnL +$3.20) |
| Posizioni chiuse | 3 (ETHUSDT ×1, AVAXUSDT ×2) |

### 2.4 Trade Eseguiti

| Data | Asset | Tipo | Entry | Exit | P&L |
|---|---|---|---|---|---|
| 30/07 14:05 | ETHUSDT | LONG | 1,926.37 | 1,861.12 | **-$101.72** |
| 02/08 05:37 | AVAXUSDT | LONG | 6.63 | 6.58 | **-$25.36** |
| 02/08 05:41 | AVAXUSDT | LONG | 6.59 | 6.60 | +$4.20 |
| 02/08 18:05 | BNBUSDT | LONG | 588.38 | — | +$3.20 (aperto) |

---

## 3. Problemi rilevati

### 🔴 P1 — Solo 2 agenti su 5 attivi

Dei 5 agenti previsti dal ProjectPlan (Technical, Macro, News, Sentiment, Whale), solo **Technical e Macro** sono attivi. News, Sentiment e Whale non sono implementati nel worker.

**Impatto:**
- Il Manager ha solo 2 report da confrontare invece di 5
- Se Macro dice WAIT e Technical dice BUY, il Manager va in stallo
- Il quorum minimo di 3 report validi **non viene mai raggiunto**, ma il codice lo bypassa perché ha 2 report validi su 2 totali (100% di quelli attivi)
- Il sistema perde completamente la dimensione news, sentiment e whale per decisioni informate

**File:** `apps/worker/src/jobs/ai-orchestration.ts:330-427` — solo TechnicalAgent e MacroAgent sono istanziati.

### 🔴 P2 — Macro-agent completamente "spento" (score zero)

Il `macro-agent` produce **esclusivamente WAIT (60%) o HOLD (40%)**, con uno **score medio di 0.00** su 399 chiamate in 3 giorni. Mai un BUY, mai un SELL, mai uno score diverso da ~0.

```
macro-agent segnali (3 giorni):
  WAIT: 238 (60%) — score medio: -0.017
  HOLD: 161 (40%) — score medio: -0.002
```

**Ipotesi sulle cause:**
1. **Prompt troppo debole** — il macro-agent riceve dati macro (BTC Dominance, Fear & Greed, S&P 500, DXY, Fed Funds Rate) ma il prompt chiede solo di valutare il "regime di rischio" (risk-on/neutral/risk-off), non di produrre un segnale direzionale.
2. **Modello sotto-dimensionato** — `deepseek-v4-pro` potrebbe non avere capacità di reasoning sufficiente per correlare dati macro a segnali crypto.
3. **Dati macro statici o insufficienti** — se Fear & Greed, S&P 500, DXY non vengono aggiornati frequentemente o mancano, il modello risponde in modo conservativo.

**File:** `packages/agents/src/agents/macro.ts:36-63`

### 🔴 P3 — Manager-agent annacqua i segnali BUY/SELL del Technical

Il `technical-agent` è l'unico che produce segnali differenziati:
```
technical-agent segnali (3 giorni):
  HOLD: 182 (46%) — score medio: +0.08
  SELL: 162 (41%) — score medio: -0.53
  BUY:   37 (9%)  — score medio: +0.60
  WAIT:  18 (4%)  — score medio: -0.15
```

Ma il `manager-agent` riduce tutto a:
```
manager-agent segnali (3 giorni):
  HOLD: 181 (46%) — score medio: 0.00
  WAIT: 106 (27%) — score medio: 0.00
  SELL:  67 (17%) — score medio: -0.79
  BUY:    4 (1%)  — score medio: +0.73
  null:  35 (9%)  — score medio: 0.00
```

**Solo 4 proposte BUY su 398 cicli (1%).** Il Manager non sta aggregando: sta appiattendo tutto a HOLD/WAIT. E quando produce BUY, il Risk Manager lo blocca per `MAX_PORTFOLIO_EXPOSURE`.

### 🟡 P4 — Esposizione portfolio blocca nuovi trade

11 RiskDecision su 71 (15%) sono state bloccate con `MAX_PORTFOLIO_EXPOSURE`. L'esempio concreto:
```
SOLUSDT BUY → Risk Manager BLOCK
  Reason: "Portfolio exposure 60.01% would exceed limit 50%"
```

Il sistema ha una posizione BNBUSDT aperta che occupa ~30% del capitale, più altre potenziali posizioni. Quando arriva un BUY su un altro asset, l'esposizione totale supera il 50% configurato.

**Possibili cause:**
- Position Sizer non scala correttamente in presenza di posizioni esistenti
- L'esposizione non tiene conto della correlazione tra asset
- La soglia del 50% potrebbe essere troppo restrittiva per un portafoglio multi-asset

### 🟡 P5 — AVAXUSDT trading frenetico il 2 agosto

Il 2 agosto tra le 05:37 e le 07:05, il sistema ha eseguito **14 decisioni APPROVE consecutive su AVAXUSDT** in ~90 minuti, aprendo e chiudendo posizioni in rapida successione:

```
05:37 BUY  AVAXUSDT → 05:38 SELL (durata: 60 secondi) — LOSS
05:41 BUY  AVAXUSDT → 05:42 SELL (durata: 60 secondi) — PROFIT
05:44–06:00: 8 APPROVE consecutivi su AVAXUSDT (non eseguiti perché già in posizione?)
```

Questo indica un **loop di trading** dove lo scanner rileva ripetutamente lo stesso asset come opportunità, l'AI produce BUY, ma il trade viene chiuso subito dopo. Possibile problema di idempotenza o cooldown assente.

### 🟡 P6 — 9 asset monitorati, solo 3 tradati

Su 9 asset configurati (BTC, ETH, SOL, BNB, XRP, LINK, SUI, AVAX, DOGE), solo **ETH, AVAX e BNB** hanno generato trade. BTC, SOL, XRP, LINK, SUI, DOGE non hanno mai prodotto un segnale sufficientemente forte da superare il Decision Gate.

### 🟡 P7 — Costi AI sprecati in segnali HOLD

| Agente | Chiamate | Token prompt | Token compl. | Costo |
|---|---|---|---|---|
| technical-agent | 399 | 340,655 | 99,155 | $0.152 |
| manager-agent | 398 | 361,854 | 44,745 | $0.131 |
| macro-agent | 399 | 178,659 | 70,381 | $0.089 |
| **Totale** | **1,196** | **881,168** | **214,281** | **$0.372** |

**$0.37 spesi per produrre 4 BUY validi.** Il 99% dei costi è andato in segnali HOLD/WAIT che non hanno generato alcuna azione. Su base annua, questo pattern costerebbe ~$38/anno senza produrre risultati.

### 🟢 P8 — I segnali SELL del technical-agent vengono ignorati

Il `technical-agent` produce 162 segnali SELL (41%) con score medio -0.53, ma questi vengono per lo più trasformati in HOLD/WAIT dal Manager. Su 67 SELL arrivati al Manager, tutti hanno score -0.79 (amplificato). Questo significa che quando il sistema vede un'opportunità di vendita, **non la esegue quasi mai** — e quando lo fa, lo score è estremamente negativo.

---

## 4. Raccomandazioni

### Priorità 1 — Attivare News, Sentiment e Whale agent

Senza questi 3 agenti, il Manager non ha abbastanza segnali diversificati per prendere decisioni. L'MVP con 2 agenti non è sufficiente per generare alpha.

**Azioni:**
1. Completare l'implementazione di `NewsAgent`, `SentimentAgent`, `WhaleAgent` in `apps/worker/src/jobs/ai-orchestration.ts`
2. Aggiungere le fonti dati necessarie (news API, social feed, whale tracker)
3. Alzare il quorum minimo a 3 report validi (con 5 agenti attivi)

### Priorità 2 — Ricalibrare il prompt del Macro Agent

Il macro-agent deve produrre **segnali direzionali** (BUY/SELL), non solo una valutazione di regime. Il prompt attuale è troppo generico.

**Azioni:**
1. Modificare il system prompt per richiedere esplicitamente un segnale BUY/SELL in base ai dati macro
2. Fornire più contesto storico (es. trend multi-giornaliero di Fear & Greed, S&P 500)
3. Aggiungere esempi few-shot nel prompt per guidare il modello verso score non-zero

### Priorità 3 — Aggiungere un cooldown per asset

Il trading frenetico su AVAXUSDT indica la necessità di un periodo minimo tra trade sullo stesso asset.

**Azioni:**
1. Aggiungere un `cooldownMinutes` configurabile per asset (es. 15-30 minuti)
2. Lo scanner deve escludere asset in cooldown dall'analisi AI
3. Il Decision Gate deve verificare il cooldown prima di approvare

### Priorità 4 — Rivedere il Manager Agent

Il Manager sta appiattendo i segnali. Con solo 2 agenti, se uno dice BUY (score 0.60) e l'altro WAIT (score 0.00), il Manager produce HOLD (score 0.00) invece di BUY con confidence ridotta.

**Azioni:**
1. Verificare se il Manager richiede unanimità invece di maggioranza
2. Abbassare la soglia di confidence minima per generare una proposta BUY/SELL
3. Considerare un peso diverso per Technical (più alto) vs Macro (più basso) quando sono solo 2

### Priorità 5 — Rivedere i limiti di esposizione

Il 50% di esposizione massima è troppo restrittivo per un portafoglio che vuole diversificare.

**Azioni:**
1. Considerare un'esposizione massima del 70-80% in paper trading
2. Aggiungere limiti per singolo asset (es. max 20% per asset)
3. Implementare un meccanismo di riduzione proporzionale quando si approssima il limite

### Priorità 6 — Ottimizzare i costi AI

$0.37 per 3 giorni di soli HOLD/WAIT non è sostenibile.

**Azioni:**
1. Aumentare la soglia minima di Opportunity Score per attivare l'AI (da 60 a 70-75)
2. Ridurre la frequenza dello scanner a 2-5 minuti invece di 60 secondi
3. Introdurre un meccanismo di skip: se l'ultimo ciclo ha prodotto NO_ACTION per tutti gli asset, saltare 1-2 cicli

---

## 5. Riepilogo metriche

| Metrica | Valore | Valutazione |
|---|---|---|
| Cicli AI completati | 434 | ✅ Normale |
| Agenti attivi | 2/5 | 🔴 Insufficiente |
| Chiamate OpenRouter | 1,196 | ✅ |
| Costo AI totale | $0.372 | ✅ Molto basso |
| Proposte BUY generate | 4 (1%) | 🔴 Inesistente |
| Proposte SELL generate | 67 (17%) | 🟡 Poche |
| Trade eseguiti | 7 | 🔴 Troppo pochi |
| Win rate | 2/4 (50%) | 🟡 |
| P&L realizzato | -$140.29 | 🔴 In perdita |
| Equity attuale | ~$9,860 | 🟡 -1.4% |
| Blocchi Risk Manager | 11/71 (15%) | 🟡 |
| Asset tradati | 3/9 | 🔴 |

---

## 6. Conclusioni

Il sistema tecnicamente funziona end-to-end ma **non è pronto per generare alpha**. Le cause sono:

1. **Architetturale:** solo 2 agenti su 5 attivi → il Manager non ha materiale sufficiente per decidere
2. **Prompt:** il macro-agent è configurato per valutare il regime, non per produrre segnali
3. **Aggregazione:** il Manager appiattisce i pochi segnali BUY/SELL del Technical
4. **Risk:** limiti di esposizione troppo restrittivi bloccano i trade quando finalmente arrivano
5. **Mancanza di guardrail:** assenza di cooldown causa trading frenetico su singoli asset

**Prossimi passi immediati:**
- Attivare i 3 agenti mancanti (News, Sentiment, Whale)
- Ricalibrare i prompt di Macro e Manager
- Aggiungere cooldown per asset
- Rivedere i limiti di esposizione

