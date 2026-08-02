# M1 — Scomposizione in task implementabili

**Milestone:** Portfolio ledger transazionale e guardrail di capitale  
**Scope:** paper trading; nessun trading reale  
**Stato:** piano di implementazione; nessun codice modificato  
**Prerequisito comune:** backup DB, worker in modalità conservativa e verifica dei dati storici prima di aggiungere vincoli unici.

## Principio di scomposizione

Ogni task è una fetta autonoma, con:

- un solo risultato verificabile;
- test dedicati che non richiedono task futuri;
- compatibilità con lo stato precedente o una migrazione inclusa nello stesso task;
- feature flag/rollout isolabile quando il comportamento può modificare il capitale paper;
- criteri di completamento binari.

I task hanno dipendenze di rollout, ma nessun task richiede una modifica futura per essere considerato corretto. Dove una dipendenza è inevitabile, il task include un adapter temporaneo o una modalità compatibile.

---

## Vista d'insieme

| ID | Task | Risultato | Dipendenze di rollout | Difficoltà |
|---|---|---|---|---|
| M1.1 | Execution identity stabile | chiave di esecuzione deterministica | nessuna | Media |
| M1.2 | Ledger balance singleton | un solo saldo paper inizializzabile atomicamente | nessuna; prima dei test concorrenti | Media |
| M1.3 | Asset exposure reale | Risk Manager riceve esposizione corrente corretta | nessuna tecnica; prima dell'attivazione guardrail | Media |
| M1.4 | BUY atomico e idempotente | BUY all-or-nothing | M1.1, M1.2 | Alta |
| M1.5 | SELL atomico e idempotente | SELL all-or-nothing con P&L coerente | M1.1, M1.2, preferibile M1.4 | Alta |
| M1.6 | Semantica P&L e mark-to-market | P&L realizzato/non realizzato/giornaliero separati | nessuna tecnica; prima del monitor | Media |
| M1.7 | Protezioni posizione persistenti | stop/take profit salvati insieme al fill | M1.4 | Media |
| M1.8 | Monitor deterministico protezioni | chiusura automatica idempotente | M1.5, M1.7 | Alta |
| M1.9 | Worker audit-before-execute | nessuna esecuzione senza audit valido | M1.1, M1.3, M1.4, M1.5 | Media |
| M1.10 | Test DB di concorrenza e recovery | evidenza PostgreSQL su crash/retry/concorrenza | M1.2, M1.4, M1.5 | Alta |
| M1.11 | Migrazione/rollout e riconciliazione | attivazione reversibile e verificata | tutti i task attivati | Media |

---

# Task dettagliati

## M1.1 — Execution identity stabile

### Obiettivo

Eliminare l'idempotenza dipendente dal timestamp. La stessa decisione deve produrre la stessa execution identity anche dopo retry, restart o ritardo del job.

### File/componenti

- `packages/risk-engine/src/risk-manager.ts`
- `packages/paper-executor/src/executor.ts`
- `packages/contracts/**`
- `packages/database/prisma/schema.prisma`, solo se serve esporre il campo
- test di `risk-engine` e `paper-executor`

### Modifica prevista

Definire una chiave canonica derivata da un identificatore stabile già disponibile, preferibilmente `proposalRunId` o una nuova `executionKey` persistita. La chiave deve essere generata una sola volta per decisione e riutilizzata dai retry.

Non usare prezzo corrente, `Date.now()` o timestamp di retry nella chiave.

Per compatibilità con record storici, distinguere esplicitamente:

- chiavi legacy;
- chiavi nuove;
- policy di riconoscimento dei retry legacy.

### Test dedicati

- stessa proposta con timestamp diversi → stessa chiave;
- proposte diverse → chiavi diverse;
- retry dello stesso `proposalRunId` → stessa chiave;
- input incompleto → errore strutturato, non chiave ambigua;
- chiave entro i limiti e formato accettato dal DB;
- compatibilità con una decisione legacy già persistita.

### Verifica autonoma

Una funzione di test deve dimostrare che due invocazioni separate del processo, con lo stesso identificatore logico, producono lo stesso valore. Nessun test richiede ancora l'executor transazionale.

### Criteri di completamento

- la chiave non cambia tra retry;
- la chiave è disponibile sia al Risk Manager sia all'executor;
- esiste una policy esplicita per record legacy;
- nessun timestamp di esecuzione partecipa al calcolo.

**Difficoltà:** media.  
**Dipendenze:** nessuna.

---

## M1.2 — Ledger balance singleton

### Obiettivo

Garantire che esista una sola riga attiva di `PaperBalance` e che due inizializzazioni concorrenti non creino due saldi.

### File/componenti

- `packages/database/prisma/schema.prisma`
- migration Prisma nuova
- `packages/paper-executor/src/executor.ts` o modulo balance dedicato
- test database del paper executor

### Modifica prevista

Sostituire il pattern `findFirst()` seguito da `create()` con una chiave singleton e un'operazione atomica/upsert. Prima della migration verificare i duplicati esistenti e definire quale record conservare.

La bonifica deve essere esplicita e reversibile tramite backup; non eliminare automaticamente dati senza criterio documentato.

### Test dedicati

- database vuoto;
- inizializzazione ripetuta sequenziale;
- due inizializzazioni concorrenti;
- database con un saldo esistente;
- rilevamento di duplicati pre-migration;
- rollback della migration su ambiente temporaneo.

### Verifica autonoma

Eseguire i test contro PostgreSQL reale/containerizzato, non contro un mock Prisma. Il task è completo anche senza BUY/SELL transazionali.

### Criteri di completamento

- al massimo una riga paper balance attiva;
- retry di inizializzazione idempotente;
- il vincolo DB impedisce una seconda riga;
- il saldo storico scelto è preservato;
- la migration fallisce in modo esplicito se trova duplicati non risolti.

**Difficoltà:** media.  
**Dipendenze:** nessuna tecnica; precede i test di concorrenza dell'executor.

---

## M1.3 — Asset exposure reale

### Obiettivo

Eliminare `assetExposure: 0` e passare al Risk Manager l'esposizione corrente del simbolo, distinta dall'esposizione totale del portafoglio.

### File/componenti

- `apps/worker/src/jobs/ai-orchestration.ts`
- `packages/risk-engine/src/risk-manager.ts`
- `packages/paper-executor/src/executor.ts` o portfolio reader
- `packages/risk-engine/tests/**`
- test worker/integration

### Modifica prevista

Creare un portfolio snapshot deterministico che calcoli:

- equity totale;
- esposizione totale;
- esposizione dell'asset corrente;
- esposizione incrementale proposta;
- prezzo usato e timestamp del prezzo.

Il Risk Manager deve verificare l'esposizione esistente più quella incrementale. Le vendite devono ridurre l'esposizione, non essere trattate come nuove esposizioni.

### Test dedicati

- portafoglio senza posizioni;
- posizione sullo stesso asset;
- posizioni su asset diversi;
- posizione con prezzo corrente aggiornato;
- BUY che supera il limite dopo l'incremento;
- BUY che rimane sotto il limite;
- SELL che riduce l'esposizione;
- prezzo mancante o stale → blocco/UNAVAILABLE secondo contratto.

### Verifica autonoma

Testare il calcolo con un portfolio snapshot fisso e confrontare il valore passato al Risk Manager con un valore atteso indipendente. Non richiede transazioni DB nuove.

### Criteri di completamento

- nessun `assetExposure` hardcoded;
- il limite per asset include posizione corrente e incremento;
- il valore è riproducibile sullo stesso snapshot;
- l'unità di misura è documentata: USDT o percentuale di equity.

**Difficoltà:** media.  
**Dipendenze:** nessuna tecnica; deve essere attivato prima di considerare affidabile il guardrail per asset.

---

## M1.4 — BUY atomico e idempotente

### Obiettivo

Rendere il BUY all-or-nothing: ordine, posizione e saldo devono essere aggiornati nella stessa transazione PostgreSQL.

### File/componenti

- `packages/paper-executor/src/executor.ts`
- `packages/database/prisma/schema.prisma`
- migration per unique execution identity
- `packages/paper-executor/tests/**`

### Modifica prevista

Raggruppare nella stessa transaction boundary:

1. lookup/idempotency check;
2. verifica saldo;
3. lock/lettura coerente del saldo e della posizione;
4. creazione ordine;
5. apertura o aggiornamento posizione;
6. decremento saldo;
7. persistenza dei metadati del fill.

Una unique violation sulla execution identity deve essere interpretata come successo già eseguito, dopo aver riletto il risultato, non come nuovo BUY.

L'ordine dei lock deve essere fisso per ridurre deadlock, ad esempio balance → asset position → order identity.

### Test dedicati

- BUY con saldo sufficiente;
- saldo insufficiente → nessun record parziale;
- BUY su posizione esistente;
- rollback dopo create order;
- rollback dopo update position;
- rollback dopo update balance;
- due BUY concorrenti con stessa execution identity;
- due BUY concorrenti diverse sullo stesso asset;
- saldo decrementato una sola volta;
- quantità posizione coerente con gli ordini FILLED.

### Verifica autonoma

Usare PostgreSQL reale e fault injection nel transaction callback. Il task deve dimostrare atomicità senza richiedere il SELL o il monitor stop.

### Criteri di completamento

- commit completo oppure rollback completo;
- una decisione produce al massimo un BUY FILLED;
- non si crea saldo negativo non consentito;
- retry post-commit restituisce l'esito esistente;
- la posizione risultante è coerente con il fill.

**Difficoltà:** alta.  
**Dipendenze:** M1.1 e M1.2.

---

## M1.5 — SELL atomico e idempotente

### Obiettivo

Rendere il SELL all-or-nothing e impedire doppio accredito del saldo o doppia chiusura della posizione.

### File/componenti

- `packages/paper-executor/src/executor.ts`
- `packages/database/prisma/schema.prisma`
- `packages/paper-executor/tests/**`

### Modifica prevista

Raggruppare in una transaction boundary:

1. lookup execution identity;
2. lock della posizione;
3. verifica quantità disponibile;
4. creazione ordine;
5. riduzione o chiusura posizione;
6. accredito saldo;
7. registrazione fee, slippage e P&L secondo semantica definita.

Definire esplicitamente la policy per sell parziale, quantità superiore alla posizione e posizione assente.

### Test dedicati

- chiusura completa;
- chiusura parziale;
- quantità superiore → rollback completo;
- posizione assente → nessun ordine FILLED;
- due SELL concorrenti sulla stessa posizione;
- retry della stessa execution identity;
- rollback dopo creazione ordine;
- rollback dopo aggiornamento posizione;
- P&L e fee applicati una sola volta;
- `closedAt`/stato coerenti.

### Verifica autonoma

Il test deve costruire direttamente una posizione paper e invocare il SELL; non richiede il worker o il monitor.

### Criteri di completamento

- saldo, posizione e ordine sono sempre coerenti;
- una vendita ripetuta non accredita due volte;
- la posizione diventa `CLOSED` solo quando la quantità è zero;
- quantità non valida non produce side effect.

**Difficoltà:** alta.  
**Dipendenze:** M1.1 e M1.2. M1.4 è consigliato per riusare l'infrastruttura, non obbligatorio a livello contrattuale.

---

## M1.6 — Semantica P&L e mark-to-market

### Obiettivo

Separare senza ambiguità P&L realizzato, non realizzato, giornaliero e cumulativo, eliminando l'uso di un singolo campo per semantiche diverse.

### File/componenti

- `packages/paper-executor/src/executor.ts`
- `packages/risk-engine/src/risk-manager.ts`
- `packages/database/prisma/schema.prisma`
- `packages/analytics/**`
- test executor/risk/analytics

### Modifica prevista

Definire un contratto esplicito:

- `realizedPnl`: risultato dei trade chiusi;
- `unrealizedPnl`: valore mark-to-market delle posizioni aperte;
- `dailyRealizedPnl`: realizzato dal reset giornaliero;
- `dailyTotalPnl`: realizzato giornaliero più variazione non realizzata, se questa è la policy;
- `cumulativePnl`: valore dalla data di inizio o dal capitale iniziale.

La scelta della metrica usata da `MAX_DAILY_LOSS` deve essere documentata e testata. Non modificare i valori storici senza una migrazione semantica dichiarata.

### Test dedicati

- giornata senza trade;
- BUY senza P&L realizzato;
- mark-to-market positivo e negativo;
- SELL con fee e slippage;
- passaggio di mezzanotte/timezone configurata;
- reset giornaliero;
- perdita realizzata e profitto non realizzato simultanei;
- risk limit basato sulla metrica scelta.

### Verifica autonoma

Testare funzioni pure con saldo/posizioni/prezzi noti. Il task è verificabile senza transazioni concorrenti e senza stop automatici.

### Criteri di completamento

- ogni metrica ha una sola semantica;
- `MAX_DAILY_LOSS` usa una metrica dichiarata;
- mark-to-market non sovrascrive il P&L realizzato;
- dashboard e Risk Manager leggono lo stesso contratto.

**Difficoltà:** media.  
**Dipendenze:** nessuna tecnica; deve precedere il monitor stop se il monitor usa P&L o limiti giornalieri.

---

## M1.7 — Protezioni posizione persistenti

### Obiettivo

Persistire stop loss e take profit insieme all'apertura/aggiornamento della posizione, senza affidarsi ai log o alla memoria del Risk Manager.

### File/componenti

- `packages/database/prisma/schema.prisma`
- migration Prisma
- `packages/paper-executor/src/executor.ts`
- `packages/risk-engine/src/position-sizer.ts`
- `packages/risk-engine/src/risk-manager.ts`
- test executor/schema

### Modifica prevista

Scegliere una sola rappresentazione persistente:

- campi su `PaperPosition` per una protezione semplice; oppure
- tabella separata per più livelli e storico dei trigger.

Per M1 è preferibile una rappresentazione minima su `PaperPosition`, con policy esplicita per aggiunte alla posizione: mantenere, stringere o sostituire lo stop; mai allargarlo senza regola deterministica.

Il take profit deve essere introdotto solo se il contratto di proposta e il risk layer lo forniscono realmente; non usare valori simulati.

### Test dedicati

- BUY con stop loss;
- BUY con stop e take profit;
- aggiunta alla posizione secondo policy;
- posizione legacy senza protezione;
- precisione `Decimal`;
- livelli non validi rispetto all'entry;
- rollback: protezione e posizione devono essere committate insieme;
- lettura della protezione dopo restart.

### Verifica autonoma

Creare una posizione tramite executor e rileggerla da PostgreSQL in una seconda connessione/processo. Non richiede ancora l'esistenza del monitor.

### Criteri di completamento

- ogni nuova posizione approvata conserva le protezioni ricevute;
- i livelli sono disponibili senza ricostruzione dai log;
- posizione e protezione hanno la stessa atomicità;
- record legacy gestiti senza crash;
- nessun take profit viene inventato quando assente.

**Difficoltà:** media.  
**Dipendenze:** M1.4 per integrazione completa del BUY; può essere preparato prima con un adapter.

---

## M1.8 — Monitor deterministico delle protezioni

### Obiettivo

Chiudere una posizione quando il prezzo raggiunge stop loss o take profit, con la stessa sicurezza transazionale del SELL manuale/AI.

### File/componenti

- nuovo job sotto `apps/worker/src/jobs/`
- `apps/worker/src/index.ts`
- `packages/paper-executor/src/executor.ts`
- `packages/market-data/src/**`
- `packages/database/prisma/schema.prisma`, se serve la causa di chiusura
- test worker/executor

### Modifica prevista

Il monitor deve:

1. leggere solo posizioni OPEN;
2. validare prezzo e freshness;
3. determinare trigger con regola esplicita sul prezzo/candle;
4. creare una execution identity derivata da posizione + livello + evento;
5. invocare il SELL atomico;
6. registrare causa `STOP_LOSS` o `TAKE_PROFIT`;
7. tollerare retry e due monitor concorrenti.

Prima dell'attivazione automatica, eseguire shadow mode: rilevare e registrare trigger senza chiudere.

### Test dedicati

- prezzo sotto/sopra lo stop secondo la direzione;
- prezzo esattamente sul livello;
- take profit raggiunto;
- prezzo non raggiunto;
- dato stale/mancante → nessuna chiusura;
- posizione già chiusa;
- due monitor concorrenti;
- retry dopo commit;
- causa di chiusura persistita;
- stop e take profit raggiunti nello stesso intervallo → priorità documentata.

### Verifica autonoma

Il monitor deve essere testabile con un provider prezzo fake controllato e un executor reale su PostgreSQL. L'abilitazione live può rimanere disattivata; il task è completo quando shadow mode e test sono verificati.

### Criteri di completamento

- un trigger produce al massimo una chiusura;
- la chiusura riusa la transaction boundary del SELL;
- dati non freschi non causano uscite;
- la causa è auditabile;
- shadow mode non modifica saldo o posizione.

**Difficoltà:** alta.  
**Dipendenze:** M1.5 e M1.7.

---

## M1.9 — Worker audit-before-execute

### Obiettivo

Impedire che il worker esegua un ordine quando la proposta o la `RiskDecision` non sono state persistite e validate correttamente.

### File/componenti

- `apps/worker/src/jobs/ai-orchestration.ts`
- `packages/database/src/**`
- `packages/paper-executor/src/executor.ts`
- `packages/contracts/**`
- test worker/integration

### Modifica prevista

Rendere esplicita la sequenza:

1. validazione proposta;
2. persistenza audit della proposta;
3. calcolo Risk Manager;
4. persistenza della `RiskDecision` con ID reale;
5. verifica che la decisione sia `APPROVE`;
6. esecuzione con execution identity stabile;
7. persistenza dell'esito.

Un errore di persistenza audit deve bloccare l'esecuzione. Un retry post-commit deve rileggere l'esito esistente.

La decisione `BLOCK` deve avere zero side effect di trading.

### Test dedicati

- `BLOCK` → nessun ordine;
- `APPROVE` → un ordine;
- persistenza proposal fallita → nessun executor call;
- persistenza risk decision fallita → nessun executor call;
- retry dello stesso job;
- due job concorrenti sullo stesso asset;
- BUY con posizione esistente;
- SELL senza posizione;
- ID RiskDecision reale coerente con l'ordine;
- errore executor dopo audit → stato e retry deterministici.

### Verifica autonoma

Usare mock solo per fault injection del repository, ma verificare almeno un percorso con DB reale. Il task non deve richiedere il monitor stop.

### Criteri di completamento

- ogni ordine ha audit proposal + risk decision persistito;
- nessun `BLOCK` produce side effect;
- nessun errore di audit viene ignorato;
- retry non crea un secondo ordine;
- `assetExposure` arriva dal portfolio snapshot reale.

**Difficoltà:** media.  
**Dipendenze:** M1.1, M1.3, M1.4 e M1.5.

---

## M1.10 — Test DB di concorrenza e crash recovery

### Obiettivo

Dimostrare con PostgreSQL reale che i task transazionali rispettano le invarianti in presenza di retry, concorrenza e rollback.

### File/componenti

- test di integrazione `packages/paper-executor/tests/**`
- nuova configurazione Vitest/integration se necessaria
- Docker Compose/test database
- migration Prisma

### Modifica prevista

Aggiungere una suite separata dai test unitari. I test devono poter creare e distruggere un database isolato e devono includere fault injection nel punto corretto della transaction callback.

### Test dedicati

- due `initPaperBalance()` concorrenti;
- due BUY stessa execution identity;
- due BUY diverse sullo stesso asset;
- due SELL sulla stessa posizione;
- crash simulato in ciascun passaggio BUY;
- crash simulato in ciascun passaggio SELL;
- retry dopo commit ma prima della risposta;
- migration su dataset storico;
- unique violation riletta come risultato già eseguito;
- nessun ordine duplicato, saldo negativo inatteso o posizione fantasma.

### Verifica autonoma

Il task è una suite verificabile contro PostgreSQL e non deve dipendere da un eventuale ambiente di produzione. Deve fallire se l'executor viene accidentalmente riportato a operazioni separate.

### Criteri di completamento

- tutte le invarianti sono espresse come assertion;
- i test sono ripetibili;
- il database viene ripulito tra i casi;
- i test coprono almeno due worker/concurrent transactions;
- il risultato è documentato come gate di rollout.

**Difficoltà:** alta.  
**Dipendenze:** M1.2, M1.4 e M1.5; M1.6/M1.7 se inclusi nei dati verificati.

---

## M1.11 — Migrazione, riconciliazione e rollout reversibile

### Obiettivo

Attivare M1 senza perdere dati e senza confondere record legacy con record creati dalla nuova versione.

### File/componenti

- `packages/database/prisma/schema.prisma`
- migration Prisma
- script di verifica/riconciliazione sotto `packages/database` o `apps/worker/scripts`
- configurazione worker/docker-compose
- documentazione operativa

### Modifica prevista

Il rollout deve prevedere:

1. backup e conteggio iniziale di balance, ordini, posizioni e risk decisions;
2. report duplicati e riferimenti incoerenti;
3. bonifica manualmente approvata o script con dry-run;
4. applicazione constraint;
5. avvio in modalità shadow/guardrail-only;
6. riconciliazione saldo = capitale iniziale + cash flow + P&L e quantità posizione = fill netti;
7. attivazione paper execution transazionale;
8. piano di rollback applicativo senza cancellare record nuovi.

### Test dedicati

- dry-run su copia del database;
- migration con dataset pulito;
- migration con duplicati attesi;
- migration interrotta e ripresa;
- riconciliazione prima/dopo;
- rollback della feature flag;
- worker vecchio che non distrugge i record nuovi;
- restart durante rollout.

### Verifica autonoma

Il task si verifica con un database snapshot e produce un report pass/fail. Non richiede modifiche future al codice per dimostrare che la migrazione è sicura.

### Criteri di completamento

- backup verificato;
- nessun duplicato non classificato;
- constraint applicati;
- riconciliazione con differenza zero o differenze spiegate e registrate;
- shadow mode osservato senza side effect inattesi;
- rollback documentato e provato.

**Difficoltà:** media.  
**Dipendenze:** task precedenti effettivamente attivati; non è un task da eseguire prima di M1.10.

---

# Ordine di implementazione e isolamento

## Iterazioni consigliate

### Iterazione A — Contratti e dati fondamentali

- M1.1
- M1.2
- M1.3
- M1.6

Questi task possono essere sviluppati in parallelo. Ognuno ha test autonomi; M1.2 richiede PostgreSQL per la verifica finale.

### Iterazione B — Esecuzione atomica

- M1.4
- M1.5

M1.4 e M1.5 possono condividere un helper transazionale, ma devono mantenere suite BUY e SELL separate. Ogni task deve essere rilasciabile senza attendere il monitor stop.

### Iterazione C — Protezioni

- M1.7
- M1.8

M1.7 è persistente e passivo; M1.8 viene inizialmente rilasciato in shadow mode. Questo evita di attivare un'uscita automatica non ancora osservata.

### Iterazione D — Orchestrazione e prova finale

- M1.9
- M1.10
- M1.11

Questi task trasformano le correzioni locali in comportamento operativo verificato e sono il gate per dichiarare M1 completata.

## Definition of Done della milestone M1

M1 è completata solo quando:

- ogni decisione eseguibile ha una execution identity stabile;
- esiste un solo `PaperBalance` attivo;
- BUY e SELL sono atomici e idempotenti su PostgreSQL;
- asset exposure corrente e incrementale sono calcolate dal portfolio reale;
- P&L realizzato, non realizzato e giornaliero hanno semantiche separate;
- stop loss e take profit, quando presenti nel contratto, sono persistiti;
- il monitor delle protezioni è testato e almeno validato in shadow mode;
- nessun errore di persistenza audit viene ignorato prima dell'esecuzione;
- test concorrenti e crash recovery passano;
- la migrazione è riconciliata e reversibile;
- il sistema resta esclusivamente paper trading.

## Cosa non appartiene a M1

Per evitare espansione dello scope, M1 non comprende:

- attivazione News/Sentiment/Whale;
- modifica dei prompt Macro o Manager;
- universo dinamico 50–100 asset;
- nuova formula Opportunity Score;
- aumento dell'esposizione massima;
- multi-model consensus;
- trading reale;
- ottimizzazione del rendimento o tuning della strategia.

