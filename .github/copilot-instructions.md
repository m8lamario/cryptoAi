# Istruzioni permanenti per GitHub Copilot

Queste istruzioni si applicano a tutto il repository.

## ARCHITETTURA

- `ProjectPlan.md` è la specifica principale del progetto.
- Leggere `ProjectPlan.md` prima di apportare modifiche architetturali.
- Lavorare su una sola fase del `ProjectPlan.md` alla volta.
- Utilizzare un monorepo pnpm con TypeScript strict.
- Utilizzare Next.js App Router per la dashboard privata.
- Utilizzare Node.js e Express per l'API interna.
- Utilizzare Node.js e BullMQ per i worker.
- Utilizzare PostgreSQL, Prisma e Redis.
- Utilizzare Zod per input, output e variabili d'ambiente.
- Utilizzare Vitest per i test.
- Utilizzare Pino per i log backend.
- Evitare microservizi prematuri.

## AMBITO SINGLE-USER

- Non implementare registrazione pubblica.
- Non implementare multi-tenancy.
- Non implementare organizzazioni o team.
- Non implementare ruoli complessi.
- Non implementare social login.
- Non implementare pagine marketing, SEO, prezzi o abbonamenti.
- È previsto un solo account proprietario.
- La dashboard Next.js è una console operativa privata.

## ARCHITETTURA IBRIDA

- Gli agenti AI producono esclusivamente `AgentReport` strutturati.
- L'Investment Manager AI produce esclusivamente `TradeProposal`.
- Nessun LLM può inviare direttamente ordini.
- Indicatori, calcoli finanziari, Position Sizer, Risk Manager ed Executor devono essere deterministici.
- Il Risk Manager ha potere di veto assoluto.
- Un errore AI deve produrre `UNAVAILABLE`, mai `HOLD`.
- Gli agenti non possono chiamare direttamente OpenRouter.
- Tutte le chiamate AI devono attraversare l'AI Gateway.
- OpenRouter e DeepSeek V4 Pro non devono essere integrati prima della fase prevista dal `ProjectPlan.md`.

## SICUREZZA

- Non inserire segreti nel repository.
- Non mostrare segreti nei log.
- Non esporre chiavi OpenRouter o exchange al browser.
- Non esporre pubblicamente PostgreSQL o Redis.
- Non implementare trading reale senza una richiesta esplicita.
- Non eseguire ordini reali durante lo sviluppo.
- Non modificare `ProjectPlan.md` senza una richiesta esplicita.
- Mantenere tutti i segreti, le credenziali dei provider AI e le credenziali exchange server-side.
- Limitare la dashboard a localhost, rete locale autorizzata o VPN privata.
- Non esporre direttamente a Internet PostgreSQL, Redis, API interne o porte amministrative.

## QUALITÀ

- Utilizzare TypeScript strict.
- Evitare `any` salvo motivazione documentata.
- Aggiungere test insieme alla nuova logica.
- Non utilizzare dati finanziari simulati fuori dai test.
- Non creare implementazioni finte senza contrassegnarle chiaramente.
- Non aggiungere dipendenze senza spiegare perché sono necessarie.
- Eseguire lint, typecheck, test e build dopo ogni implementazione.
- Non eseguire automaticamente git commit.
- Non estendere lo scope della fase richiesta.
