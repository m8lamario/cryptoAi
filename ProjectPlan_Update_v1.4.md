# Project Plan Update v1.4

**Data:** 1 Agosto 2026

## Obiettivo

Trasformare il progetto da semplice assistente di analisi ad una
piattaforma di investimento personale guidata da AI, con l'obiettivo di
massimizzare il rendimento corretto per il rischio.

------------------------------------------------------------------------

# 1. Nuova Filosofia

## Obiettivo Primario

Il sistema deve massimizzare il rendimento corretto per il rischio nel
medio e lungo periodo.

L'AI può decidere autonomamente se:

-   non operare;
-   fare scalping;
-   fare intraday;
-   fare swing;
-   mantenere una posizione di lungo periodo.

L'obiettivo non è aumentare il numero di trade ma la qualità delle
decisioni.

------------------------------------------------------------------------

# 2. Decision Engine Evoluto

Ogni proposta dovrà includere:

``` ts
interface TradingPlan {
  strategy: "SCALPING" | "INTRADAY" | "SWING" | "POSITION";
  expectedDuration: string;
  expectedProfitPercent: number;
  expectedRiskPercent: number;
  confidence: number;
  suggestedEntry: number;
  suggestedTakeProfit: number;
  suggestedStopLoss: number;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}
```

------------------------------------------------------------------------

# 3. Trigger Event Driven

Eliminare il concetto di analisi AI a intervalli fissi.

Pipeline:

    Market Scanner (30-60 secondi)
            ↓
    Indicatori Tecnici
            ↓
    Market Opportunity Score
            ↓
    Trigger AI
            ↓
    Investment Manager
            ↓
    Risk Manager

L'AI viene attivata solo quando il mercato presenta condizioni
interessanti.

------------------------------------------------------------------------

# 4. Market Opportunity Score

Valutazione continua basata su:

-   RSI
-   MACD
-   ATR
-   EMA
-   SMA
-   Volume
-   Volatilità
-   Funding Rate
-   Open Interest
-   Whale Activity
-   Sentiment
-   News
-   Breakout

Classificazione:

-   0-30 → Ignora
-   30-60 → Monitoraggio
-   60-80 → Analisi AI
-   80-100 → Priorità Massima

------------------------------------------------------------------------

# 5. AI Memory

Ogni operazione deve memorizzare:

-   contesto
-   indicatori
-   modello AI
-   prompt
-   decisione
-   risultato dopo:
    -   1 ora
    -   6 ore
    -   24 ore
    -   7 giorni
    -   30 giorni

Obiettivo:

-   confrontare modelli
-   confrontare prompt
-   migliorare le performance nel tempo

------------------------------------------------------------------------

# 6. Multi Model Architecture

Supportare:

-   GPT
-   Claude
-   Gemini
-   DeepSeek

Modalità:

1.  singolo modello;
2.  secondo parere;
3.  consenso tra modelli.

------------------------------------------------------------------------

# 7. Approvazione Automatica

Regole suggerite:

  Condizione            Azione
  --------------------- ----------------------------------------
  Trade \<1% capitale   Automatico
  1-3% capitale         Automatico solo con confidence elevata
  \>3% capitale         Richiede approvazione
  \>5% capitale         Sempre approvazione manuale

------------------------------------------------------------------------

# 8. Dashboard 2.0

## Hero

Visualizzare immediatamente:

-   Valore Portafoglio
-   Profitto Totale
-   Profitto Giornaliero
-   Stato AI

------------------------------------------------------------------------

## KPI

-   Equity
-   Profit/Loss
-   ROI
-   Win Rate
-   Profit Factor
-   Sharpe Ratio
-   Max Drawdown

------------------------------------------------------------------------

## Grafici

-   Equity Curve
-   Distribuzione trade
-   Performance per asset
-   Performance per strategia

------------------------------------------------------------------------

## Ultima Decisione

Mostrare:

-   BUY / SELL
-   Confidence
-   Strategia scelta
-   Durata prevista
-   Motivazione

------------------------------------------------------------------------

## Stato Agenti

-   Technical
-   Macro
-   News
-   Whale
-   Sentiment
-   Investment Manager

con stato:

🟢 🟡 🔴

------------------------------------------------------------------------

## Timeline

Cronologia eventi:

-   Apertura trade
-   Chiusura trade
-   Stop Loss
-   Take Profit
-   News
-   Whale
-   Decisioni AI

------------------------------------------------------------------------

## Costi AI

Visualizzare:

-   Token utilizzati
-   Costo giornaliero
-   Costo mensile

------------------------------------------------------------------------

# 9. Modalità Operative

## Paper Trading

100% virtuale.

## Assisted Trading

L'AI propone.

L'utente conferma.

## Autonomous Trading

L'AI esegue automaticamente entro i limiti definiti.

------------------------------------------------------------------------

# 10. Metriche di Successo

Confrontare sempre:

-   Buy & Hold
-   Bot Quantitativo
-   Sistema AI

Monitorare:

-   rendimento netto;
-   drawdown;
-   Sharpe Ratio;
-   Sortino Ratio;
-   win rate;
-   profit factor;
-   costo API;
-   tempo medio delle operazioni.

------------------------------------------------------------------------

# 11. Visione Finale

La dashboard deve apparire come una console professionale ispirata a
TradingView e Bloomberg.

L'utente deve poter capire in pochi secondi:

1.  Se il sistema sta guadagnando o perdendo.
2.  Quanto sta guadagnando/perdendo.
3.  Cosa sta facendo l'AI.
4.  Se è richiesta un'azione manuale.
5.  Qual è il livello di rischio attuale.
