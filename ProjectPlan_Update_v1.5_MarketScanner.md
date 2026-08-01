# Project Plan Update v1.5

**Data:** 1 Agosto 2026

# Evoluzione Multi-Asset e Market Scanner

## Obiettivo

Evolvere il sistema da una piattaforma che monitora un numero limitato
di criptovalute ad un motore intelligente capace di individuare
autonomamente le migliori opportunità presenti sul mercato.

------------------------------------------------------------------------

# 1. Filosofia

L'AI non deve essere limitata ad un elenco fisso di asset.

Il sistema deve essere in grado di analizzare l'intero mercato e
concentrare le risorse computazionali solamente sugli asset che
presentano le migliori probabilità di generare un rendimento corretto
per il rischio.

------------------------------------------------------------------------

# 2. Roadmap degli Asset

## Fase MVP

Asset iniziali:

-   BTC
-   ETH
-   SOL

Obiettivo:

-   validare la pipeline dati;
-   validare il Risk Manager;
-   validare il Paper Trading;
-   validare il Decision Engine;
-   raccogliere metriche.

------------------------------------------------------------------------

## Fase Intermedia

Espandere gradualmente il monitoraggio includendo:

-   BNB
-   XRP
-   LINK
-   SUI
-   AVAX
-   DOGE

Totale previsto:

8-10 asset ad alta capitalizzazione e liquidità.

------------------------------------------------------------------------

## Fase Avanzata

Il sistema non utilizza più una watchlist fissa.

Ogni ciclo esegue uno scanner sul mercato e seleziona automaticamente
gli asset più interessanti.

------------------------------------------------------------------------

# 3. Market Scanner

Il Market Scanner deve essere eseguito periodicamente e raccogliere dati
per le prime 50-100 criptovalute.

Metriche considerate:

-   volume
-   volatilità
-   variazione percentuale
-   liquidità
-   market cap
-   breakout
-   funding rate
-   open interest
-   whale activity
-   sentiment
-   news

Output:

Una lista ordinata di asset candidati.

------------------------------------------------------------------------

# 4. Opportunity Ranking

Ogni asset riceve un Opportunity Score da 0 a 100.

Classificazione:

-   0-30 → Ignora
-   30-60 → Monitoraggio
-   60-80 → Analisi quantitativa
-   80-100 → Analisi AI completa

L'Investment Manager riceve esclusivamente gli asset con il punteggio
più elevato.

------------------------------------------------------------------------

# 5. Pipeline Decisionale

    Scanner Mercato

    ↓

    100 Asset

    ↓

    Filtri di liquidità

    ↓

    Opportunity Score

    ↓

    Top 10

    ↓

    Analisi Quantitativa

    ↓

    Top 3-5

    ↓

    Agenti AI

    ↓

    Investment Manager

    ↓

    Risk Manager

    ↓

    Paper Trading / Trading Reale

------------------------------------------------------------------------

# 6. Dashboard

Nuove sezioni.

## Opportunity Ranking

Visualizzare:

-   posizione
-   asset
-   score
-   variazione 24h
-   stato

Esempio:

1.  BTC 91
2.  SUI 88
3.  LINK 86

------------------------------------------------------------------------

## Heatmap Mercato

Mostrare graficamente:

-   trend
-   volatilità
-   momentum
-   opportunità

------------------------------------------------------------------------

## Watchlist Dinamica

La watchlist viene aggiornata automaticamente in base allo scanner.

L'utente può:

-   bloccare asset preferiti;
-   escludere asset;
-   definire whitelist e blacklist.

------------------------------------------------------------------------

# 7. Configurazione

Configurazioni modificabili:

-   numero massimo di asset analizzati;
-   numero massimo di asset inviati agli agenti AI;
-   soglia minima Opportunity Score;
-   frequenza dello scanner;
-   capitale massimo per asset.

------------------------------------------------------------------------

# 8. Benefici

-   Minori costi AI.
-   Maggiore probabilità di individuare opportunità.
-   Nessun vincolo a una lista statica di criptovalute.
-   Sistema facilmente scalabile.

------------------------------------------------------------------------

# 9. Criteri di Successo

Il nuovo modulo sarà considerato completo quando:

-   lo scanner analizza almeno 50 asset;
-   il ranking viene aggiornato automaticamente;
-   gli agenti AI analizzano solo gli asset prioritari;
-   la dashboard mostra chiaramente le migliori opportunità del momento;
-   il sistema mantiene tempi di risposta e costi prevedibili.
