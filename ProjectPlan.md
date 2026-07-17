# Project Plan: Hybrid AI Crypto Investment Agent

**Versione:** 1.2  
**Data:** 17 luglio 2026  
**Ambito:** applicazione privata, single-user e self-hosted  
**Piattaforma prevista:** mini PC Intel N100  
**Obiettivo:** realizzare un assistente personale ibrido per l'analisi del mercato crypto, nel quale agenti AI producono valutazioni strutturate mentre dati, calcoli, gestione del rischio ed esecuzione rimangono deterministici e verificabili.

---

## 1. Visione e principi

### 1.1 Visione

Creare una console finanziaria personale che analizzi il mercato crypto continuativamente combinando:

- agenti AI specializzati nell'interpretazione di dati tecnici, notizie, sentiment, movimenti whale e contesto macroeconomico;
- software quantitativo per calcoli, indicatori e valutazioni numeriche;
- un Investment Manager AI che confronta i report e formula una proposta;
- un motore deterministico che dimensiona la posizione e applica tutti i limiti di rischio;
- paper trading obbligatorio prima di qualsiasi eventuale operatività reale.

Il sistema non deve essere considerato una garanzia di profitto. La protezione del capitale, la tracciabilità e la possibilità di non operare hanno priorità sulla frequenza delle operazioni.

### 1.2 Ambito single-user

Il sistema è progettato esclusivamente per il proprietario dell'installazione.

Non è:

- un sito pubblico;
- un prodotto SaaS;
- una piattaforma multi-tenant;
- un servizio per clienti terzi;
- un social network finanziario;
- una piattaforma di consulenza finanziaria.

Conseguenze architetturali:

- nessuna registrazione pubblica;
- nessuna gestione di organizzazioni o team;
- nessun sistema di abbonamento o pagamento;
- nessuna pagina marketing o SEO;
- un solo account proprietario;
- un solo profilo di rischio principale;
- dashboard accessibile soltanto da localhost, rete locale autorizzata o VPN privata;
- API, PostgreSQL e Redis non esposti direttamente a Internet;
- segreti disponibili esclusivamente ai processi server-side;
- nessuna chiave OpenRouter o exchange inviata al browser.

### 1.3 Principio ibrido vincolante

Gli agenti AI interpretano dati e producono report, ma non controllano direttamente denaro o ordini.

Devono rimanere deterministici:

- raccolta e normalizzazione dei dati;
- calcolo di indicatori tecnici;
- calcolo di P&L, commissioni e slippage;
- Position Sizer;
- Risk Manager;
- controllo del kill switch;
- validazione finale;
- Paper Trading Executor;
- Real Trading Executor.

L'Investment Manager AI produce una `TradeProposal`, non un ordine eseguibile.

### 1.4 Obiettivi principali

- Analisi multi-fonte tecnica, news, sentiment, whale e macro.
- Agenti AI con responsabilità e contesti separati.
- Output JSON strutturati, validati e versionati.
- Spiegazione di ogni proposta e di ogni blocco.
- Potere di veto assoluto del Risk Manager deterministico.
- Audit completo di dati, report, modelli, prompt e decisioni.
- Controllo del costo delle API AI.
- Confronto con buy-and-hold e bot quantitativo senza AI.
- Architettura modulare, ma senza microservizi prematuri.
- Nessuna operazione reale finché la validazione non è completata.

---

## 2. Architettura logica

```text
┌─────────────────────────────────────────────────────────────┐
│                Dashboard privata Next.js                    │
│ Stato, report, configurazione, approvazioni, kill switch     │
└───────────────────────────┬─────────────────────────────────┘
                            │ API interna
┌───────────────────────────▼─────────────────────────────────┐
│                  Data & Quantitative Layer                  │
│ Fetch, validazione, OHLCV, indicatori, volatilità, P&L      │
└───────────────────────────┬─────────────────────────────────┘
                            │ contesti compatti
┌───────────────────────────▼─────────────────────────────────┐
│                       AI Analyst Layer                      │
│ Technical | News | Sentiment | Whale | Macro                │
└───────────────────────────┬─────────────────────────────────┘
                            │ AgentReport validati
┌───────────────────────────▼─────────────────────────────────┐
│                    Investment Manager AI                    │
│ Confronta i report e produce una TradeProposal              │
└───────────────────────────┬─────────────────────────────────┘
                            │ proposta strutturata
┌───────────────────────────▼─────────────────────────────────┐
│             Deterministic Decision & Risk Layer             │
│ Quorum, soglie, Position Sizer, Risk Manager, veto           │
└───────────────────────────┬─────────────────────────────────┘
                            │ ordine validato
┌───────────────────────────▼─────────────────────────────────┐
│                Paper / Real Trading Executor                │
│ Idempotenza, conferme, audit log e kill switch               │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Componenti sul mini PC N100

Il mini PC ospita:

- dashboard Next.js;
- API Node.js;
- worker BullMQ;
- orchestratore degli agenti;
- PostgreSQL;
- Redis;
- acquisizione e normalizzazione dati;
- calcoli quantitativi;
- Risk Manager;
- paper trading;
- audit log;
- notifiche;
- monitoraggio di base.

L'inferenza AI principale non viene eseguita localmente. Il mini PC richiama OpenRouter tramite un AI Gateway server-side.

### 2.2 OpenRouter e DeepSeek V4 Pro

Provider AI iniziale:

```text
Provider: OpenRouter
Modello preferito: deepseek/deepseek-v4-pro
```

Linee guida applicative:

- contesto massimo per un agente analista: 16.000 token;
- contesto massimo per Investment Manager: 32.000 token;
- output massimo consigliato: 1.500 token;
- reasoning degli analisti: `high`;
- reasoning dell'Investment Manager: `high`;
- eventuale Second Opinion: `xhigh`, solo per casi rari;
- temperature bassa;
- output obbligatoriamente strutturato;
- budget giornaliero e mensile configurabile;
- nessun fallback a pagamento non autorizzato.

Nonostante il provider possa offrire finestre di contesto superiori, il software deve inviare soltanto dati pertinenti e sintetici.

### 2.3 AI Gateway

Tutti gli agenti devono usare un'interfaccia comune. Nessun agente può chiamare OpenRouter direttamente.

Responsabilità dell'AI Gateway:

- provider e modello configurabili;
- output JSON strutturato;
- validazione Zod;
- timeout;
- retry limitati;
- gestione di errori HTTP, rate limit e credito esaurito;
- circuit breaker;
- fallback espliciti;
- conteggio token;
- latenza;
- costo stimato;
- budget giornaliero e mensile;
- registrazione del modello richiesto ed effettivamente utilizzato;
- versionamento di prompt e schema;
- rimozione dei segreti dai log.

### 2.4 Regole di indisponibilità

- Errore AI non significa `HOLD`.
- Una chiamata fallita produce `UNAVAILABLE`.
- Un output non conforme produce `INVALID`.
- Nessun segnale viene inventato per sostituire un report mancante.
- Con tre o meno report validi su cinque non vengono aperte nuove posizioni.
- Il numero minimo di report richiesti deve essere configurabile.
- Dati scaduti o incompleti devono ridurre la qualità o bloccare la decisione.

---

## 3. Contratti principali

### 3.1 AgentReport

Ogni agente restituisce almeno:

```text
status: VALID | UNAVAILABLE | INVALID
runId
agentId
agentVersion
promptVersion
requestedModel
actualModel
asset
horizon: SHORT | MEDIUM | LONG
signal: BUY | SELL | HOLD | WAIT | null
score: -1..1
confidence: 0..1
dataQuality: 0..1
reasoning[]
supportingEvidence[]
opposingEvidence[]
sourceIds[]
generatedAt
usage.promptTokens
usage.completionTokens
usage.latencyMs
usage.estimatedCostUsd
```

Un report `UNAVAILABLE` o `INVALID` non può contenere un segnale finanziario valido.

### 3.2 TradeProposal

L'Investment Manager produce:

```text
status: VALID | NO_ACTION | UNAVAILABLE | INVALID
asset
action: BUY | SELL | HOLD | WAIT | null
confidence
rationale[]
reportIds[]
suggestedRiskFraction
invalidationConditions[]
expiresAt
```

`suggestedRiskFraction` è soltanto un suggerimento percentuale. L'importo finale viene calcolato dal Position Sizer.

### 3.3 RiskDecision

Il Risk Manager produce:

```text
status: APPROVE | BLOCK
ruleCode
reason
observedValue
configuredLimit
positionSize
stopLoss
idempotencyKey
decidedAt
```

---

## 4. Stack tecnico

### 4.1 Monorepo

- pnpm workspaces;
- TypeScript strict;
- ESLint;
- Prettier;
- Vitest;
- GitHub Actions.

### 4.2 Dashboard

- Next.js;
- App Router;
- React;
- Tailwind CSS;
- nessuna cartella `src`;
- React Compiler disabilitato inizialmente;
- Server Components quando possibile;
- Client Components soltanto per interazioni necessarie.

### 4.3 Backend e worker

- Node.js;
- TypeScript;
- Express;
- BullMQ;
- Redis;
- Zod;
- Pino;
- OpenAPI per documentazione interna.

### 4.4 Persistenza

- PostgreSQL;
- Prisma ORM;
- migration versionate;
- backup automatici;
- timestamp UTC;
- vincoli univoci per deduplicazione.

### 4.5 Infrastruttura

- Ubuntu Server consigliato sul mini PC;
- Docker e Docker Compose;
- servizi applicativi accessibili solo dalla rete autorizzata;
- VPN privata per accesso remoto;
- nessun port forwarding pubblico della dashboard;
- PostgreSQL e Redis senza porte pubbliche in produzione.

### 4.6 Modello dell'utente

Viene mantenuta l'entità `User`, ma l'applicazione applica la regola single-owner:

- esiste un solo record proprietario;
- nessun endpoint pubblico di registrazione;
- nessuna creazione autonoma di utenti;
- creazione iniziale tramite seed o comando amministrativo;
- eventuale autenticazione locale con un solo ruolo `OWNER`.

---

## 5. Struttura del repository

```text
/
├── ProjectPlan.md
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .env.example
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   └── AGENTS.md
│   ├── api/
│   │   └── src/
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── services/
│   └── worker/
│       └── src/
│           ├── agents/
│           ├── jobs/
│           ├── orchestration/
│           └── notifications/
├── packages/
│   ├── contracts/
│   ├── config/
│   ├── database/
│   ├── ai-gateway/
│   ├── market-data/
│   ├── quantitative/
│   ├── risk-engine/
│   ├── paper-executor/
│   └── typescript-config/
└── infrastructure/
    ├── backups/
    └── monitoring/
```

---

## 6. Metodologia di sviluppo

- Sprint brevi e incrementali.
- Una fase del ProjectPlan alla volta.
- Modalità Copilot `Plan` prima di modifiche importanti.
- Modalità Copilot `Agent` soltanto dopo l'approvazione del piano.
- Test automatici insieme alla funzionalità.
- Commit piccoli e manuali.
- Nessun commit automatico dell'agente.
- Nessun segreto nel repository.
- Lint, typecheck, test e build obbligatori prima di ogni milestone.
- Paper trading obbligatorio.
- Confronto con baseline obbligatorio.
- Prompt, modelli e output AI versionati.

---

## 7. Roadmap

### Fase 0 - Fondamenta private single-user

**Obiettivo:** creare un monorepo funzionante e una console privata minimale.

Attività:

- inizializzare pnpm workspaces;
- spostare Next.js in `apps/web`;
- creare `apps/api`;
- creare `apps/worker`;
- creare i package condivisi di base;
- configurare TypeScript strict, ESLint, Prettier e Vitest;
- configurare PostgreSQL e Redis con Docker Compose;
- creare schema iniziale Prisma con `User`, `RiskProfile` e `SystemEvent`;
- creare un singolo proprietario tramite seed;
- aggiungere endpoint `/health` e `/ready`;
- aggiungere graceful shutdown;
- aggiungere GitHub Actions;
- documentare avvio e configurazione.

Non incluso:

- registrazione;
- autenticazione completa;
- OpenRouter;
- agenti;
- dati crypto;
- trading;
- dashboard finanziaria.

**Criterio di completamento:** installazione pulita, migration, seed, lint, typecheck, test e build completati correttamente.

### Fase 0B - Accesso proprietario e sicurezza locale

**Obiettivo:** proteggere la dashboard quando viene utilizzata dalla LAN o tramite VPN.

Attività:

- autenticazione locale single-owner;
- password con hashing robusto;
- cookie di sessione sicuro;
- protezione CSRF dove applicabile;
- rate limit del login;
- session timeout;
- audit dei login;
- nessuna registrazione o recupero password via email;
- configurazione firewall e binding delle porte;
- documentazione per accesso LAN e VPN.

**Criterio di completamento:** un solo proprietario può accedere e gli endpoint riservati non sono disponibili senza sessione valida.

### Fase 1 - Pipeline dati di mercato

**Obiettivo:** acquisire e storicizzare dati reali.

Attività:

- interfaccia `MarketDataProvider`;
- integrazione di un provider iniziale;
- asset iniziali BTC, ETH e SOL;
- candele OHLCV da 15 minuti;
- `Asset`, `PriceCandle`, `MarketSnapshot`, `DataCollectionRun`;
- timestamp UTC;
- deduplicazione;
- job BullMQ;
- timeout, retry, rate limit e circuit breaker;
- endpoint `latest` e `history`;
- test con provider mock.

**Criterio di completamento:** dati reali aggiornati automaticamente e consultabili dalla dashboard.

### Fase 2 - Motore quantitativo e Risk Manager

**Obiettivo:** implementare la parte deterministica prima degli agenti AI.

Attività:

- SMA, EMA, RSI, MACD, ATR e volatilità;
- calcolo P&L;
- Position Sizer;
- limiti su esposizione totale e per asset;
- perdita giornaliera massima;
- drawdown massimo;
- stop-loss obbligatorio;
- kill switch persistente;
- idempotency key;
- gestione di dati scaduti;
- test parametrizzati con copertura superiore all'80% sul Risk Manager.

**Criterio di completamento:** una proposta fittizia può essere approvata o bloccata in modo riproducibile.

### Fase 2B - AI Gateway e OpenRouter

**Obiettivo:** integrare OpenRouter senza accoppiare gli agenti al provider.

Attività:

- interfaccia `AIProvider`;
- implementazione `OpenRouterProvider`;
- configurazione di `deepseek/deepseek-v4-pro`;
- output strutturati;
- schemi Zod;
- timeout e retry limitati;
- gestione 402, 429 e timeout;
- budget giornaliero e mensile;
- circuit breaker;
- logging di token, costo, latenza e modello;
- test tramite mock HTTP;
- nessuna chiamata reale nei test automatici.

**Criterio di completamento:** una richiesta controllata produce un report validato e contabilizzato.

### Fase 3 - Agenti AI specializzati

#### 3.1 News AI Agent

- analisi di titoli e contenuti recuperati dal software;
- distinzione fra fatto, opinione e voce non verificata;
- impatto per asset;
- evidenze favorevoli e contrarie;
- output `AgentReport`.

#### 3.2 Technical AI Agent

- riceve indicatori già calcolati;
- non riceve serie storiche inutilmente lunghe;
- non calcola indicatori;
- interpreta trend, volatilità e struttura di mercato;
- output `AgentReport`.

#### 3.3 Sentiment AI Agent

- riceve post già raccolti, puliti e deduplicati;
- valuta sentiment, euforia, paura e qualità del campione;
- output `AgentReport`.

#### 3.4 Whale AI Agent

- riceve transazioni già normalizzate;
- interpreta trasferimenti da e verso exchange;
- distingue movimenti potenzialmente significativi da trasferimenti interni;
- output `AgentReport`.

#### 3.5 Macro AI Agent

- riceve dati macro raccolti dal software;
- valuta regime `risk-on`, `neutral` o `risk-off`;
- output `AgentReport`.

**Criterio di completamento:** tutti gli agenti producono report validati senza accesso diretto a ordini o capitale.

### Fase 4 - Investment Manager AI

**Obiettivo:** combinare i report in una proposta spiegabile.

Attività:

- quorum minimo;
- confronto di evidenze favorevoli e contrarie;
- qualità dei dati;
- gestione del disaccordo;
- output `TradeProposal`;
- scadenza della proposta;
- condizioni di invalidazione;
- nessun importo definitivo;
- Decision Gate deterministico dopo il Manager;
- eventuale Second Opinion opzionale.

**Criterio di completamento:** il Manager propone `BUY`, `SELL`, `HOLD`, `WAIT` o `NO_ACTION`, ma non può eseguire l'operazione.

### Fase 5 - Memoria e valutazione

Attività:

- registrazione di ogni `AgentReport`;
- registrazione di ogni `TradeProposal`;
- registrazione dei blocchi del Risk Manager;
- versionamento prompt e modello;
- accuratezza per agente e modello;
- percentuale di JSON validi;
- fallback rate;
- latenza;
- costo per agente;
- confronto fra confidence e risultato effettivo.

**Criterio di completamento:** performance e affidabilità sono misurabili per agente, modello e versione del prompt.

### Fase 6 - Dashboard operativa e notifiche

Schermate:

- stato del sistema;
- stato dei servizi;
- ultimi dati di mercato;
- report degli agenti;
- proposte del Manager;
- blocchi del Risk Manager;
- configurazione del rischio;
- paper portfolio;
- storico decisioni;
- costi OpenRouter;
- budget residuo;
- kill switch;
- audit log.

Notifiche:

- Telegram per eventi critici;
- opportunità rilevata;
- proposta bloccata;
- richiesta di approvazione;
- budget AI esaurito;
- dati scaduti;
- servizio non disponibile;
- attivazione del kill switch.

### Fase 7 - Paper trading e backtesting

Attività:

- saldo virtuale;
- commissioni;
- slippage;
- ordini e posizioni simulate;
- report giornaliero;
- backtest walk-forward;
- prevenzione del look-ahead bias;
- dati point-in-time quando disponibili;
- scenari di crash;
- confronto fra tre sistemi.

Baseline:

1. buy-and-hold;
2. bot quantitativo senza AI;
3. sistema ibrido completo.

Metriche:

- rendimento netto;
- massimo drawdown;
- Sharpe ratio;
- Sortino ratio;
- turnover;
- commissioni;
- slippage;
- costo API;
- percentuale di operazioni corrette;
- profitto e perdita medi;
- stabilità fuori campione.

**Criterio di completamento:** il sistema ibrido deve dimostrare un beneficio misurabile corretto per rischio e costi, non soltanto un rendimento maggiore in un singolo test.

### Fase 8 - Eventuale exchange reale

Questa fase è opzionale e subordinata alla validazione precedente.

Attività:

- modalità read-only iniziale;
- chiave senza permesso di prelievo;
- allowlist degli asset;
- conferma manuale di ogni ordine iniziale;
- capitale molto ridotto;
- limite giornaliero rigido;
- kill switch locale e Telegram;
- idempotenza degli ordini;
- riconciliazione con exchange;
- monitoraggio continuo;
- rollback verso sola lettura.

**Criterio di completamento:** nessuna operatività reale senza controlli superati e autorizzazione esplicita del proprietario.

---

## 8. Sicurezza

- Segreti esclusivamente in variabili d'ambiente o secret store.
- `.env` escluso da Git.
- `.env.example` senza valori sensibili.
- Chiavi exchange senza permesso di prelievo.
- OpenRouter chiamato soltanto server-side.
- Redazione automatica dei segreti nei log.
- PostgreSQL e Redis non esposti pubblicamente.
- Accesso remoto tramite VPN privata.
- Backup cifrati.
- Rotazione periodica delle chiavi.
- Dipendenze aggiornate e controllate.
- Audit log append-only per eventi critici.
- Kill switch persistente.
- Nessuna esecuzione se dati, servizi o report non sono sufficientemente affidabili.

---

## 9. Gestione dei rischi di progetto

### Overengineering

**Mitigazione:** monolite modulare con un'API, un worker, un database e una coda. Nessun microservizio per agente nella prima versione.

### Allucinazioni AI

**Mitigazione:** contesti preparati dal software, output strutturati, validazione Zod, temperature bassa, prove contrarie obbligatorie e nessuna esecuzione diretta.

### Falso consenso

**Mitigazione:** fonti e responsabilità differenti, prompt separati, qualità dei dati esplicita e registrazione del modello usato.

### Costi OpenRouter inattesi

**Mitigazione:** limiti di token, cache, chiamate event-driven, budget giornaliero e mensile, circuit breaker e output brevi.

### Modello indisponibile

**Mitigazione:** stato `UNAVAILABLE`, fallback espliciti e blocco di nuove operazioni quando manca il quorum.

### Dati sporchi o mancanti

**Mitigazione:** validazione, deduplicazione, timestamp UTC, freshness check, fonti alternative e blocco in caso di qualità insufficiente.

### Backtest ingannevole

**Mitigazione:** walk-forward, separazione train/test, commissioni, slippage, dati point-in-time, confronto con baseline e test fuori campione.

### Esposizione pubblica accidentale

**Mitigazione:** binding controllato, firewall, VPN, nessun port forwarding, porte database interne e autenticazione single-owner.

### Trading reale pericoloso

**Mitigazione:** paper trading prolungato, chiavi ristrette, conferma manuale, capitale minimo, kill switch e limiti deterministici.

---

## 10. Milestone

### M1 - Fondamenta

Monorepo, dashboard privata minimale, API, worker, PostgreSQL, Redis e CI funzionanti.

### M2 - Dati e motore deterministico

Dati reali, indicatori, Position Sizer e Risk Manager testati.

### M3 - AI Gateway

OpenRouter integrato con costi, budget, output strutturati e fallback controllati.

### M4 - Agenti AI

Cinque agenti producono report validati e tracciabili.

### M5 - Manager ibrido

Investment Manager AI produce proposte sottoposte al Decision Gate e al Risk Manager.

### M6 - Paper trading

Sistema valutato rispetto a buy-and-hold e bot quantitativo.

### M7 - Eventuale go-live controllato

Solo dopo risultati fuori campione, periodo di paper trading e revisione completa della sicurezza.

---

## 11. Criteri globali di successo

Il progetto è considerato tecnicamente valido quando:

- tutte le decisioni sono ricostruibili;
- nessun LLM può bypassare il Risk Manager;
- errori e indisponibilità producono un blocco sicuro;
- i costi AI sono misurabili e limitati;
- il sistema è utilizzabile sul mini PC N100;
- la dashboard non è esposta pubblicamente;
- paper trading e backtesting includono costi realistici;
- il sistema ibrido viene confrontato con baseline più semplici;
- lint, typecheck, test e build sono automatizzati;
- l'eventuale trading reale richiede una decisione esplicita separata.

Il sistema ibrido è considerato migliore di un bot tradizionale soltanto se dimostra su dati fuori campione un miglioramento stabile del rendimento corretto per il rischio, senza costi o drawdown sproporzionati.

---

## 12. Funzionalità esplicitamente fuori scope

- registrazione pubblica;
- multi-tenancy;
- gestione clienti;
- organizzazioni e team;
- marketplace di strategie;
- copy trading;
- pagamenti e abbonamenti;
- consulenza finanziaria per terzi;
- app mobile nativa nella prima versione;
- high-frequency trading;
- custodia di fondi;
- prelievi automatici;
- autonomia degli LLM su capitale e ordini;
- addestramento locale di modelli sul mini PC N100.
