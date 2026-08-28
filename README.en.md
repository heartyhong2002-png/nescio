# Nescio

[한국어 버전](./README.md)

An app that explains "why did it go up? why did it go down?" for stock market
beginners. Register the stocks you're watching, and Nescio ties today's price
move to the news behind it — explained the way a friend would, not like an
analyst report.

## What it does

1. Search for and register stocks you're watching (based on the KRX stock list).
2. On the home screen, see each watched stock's price change for the day and
   a one-line summary as a card.
3. Tap a stock to see a breakdown of "why it moved" by cause — a
   cause-and-effect timeline, the news it's based on, positive/negative
   factors, and even similar past cases.
4. Explanations are generated through a two-stage LLM pipeline: stage 1
   (NVIDIA) analyzes the price and news factually, and stage 2 (xAI Grok)
   rewrites that analysis in a casual character voice (the tone intensity is
   adjustable across 4 levels — see `TONE_RULES` in
   `src/app/api/analyze/route.ts`). It never recommends buying or selling,
   and a disclaimer is always appended.

## Folder structure

```
src/                     The actual Next.js app in production (this is the real thing)
  app/                   Screens (onboarding/watchlist/stock detail/alerts/my page) and API routes
  lib/                   Shared logic: KRX prices, storage (localStorage), formatting, etc.
public/                  Static files
notebooks/.env           API keys for local development (not committed — see Environment Variables below)
data-pipeline/           Early data pipeline experiments (Python, pykrx + Naver + LLM analysis
                         notebooks/scripts) — not used by the live service, kept for
                         prompt/pipeline design experiments
legacy-ui-mockup/        Static HTML UI mockup made on 8/23 (an earlier version of the current
                         screens, kept for reference)
docs/                    Technical notes from past sessions (HANDOFF.md, etc.)
```

## Getting started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Environment variables

Fill in the values below in `notebooks/.env` to enable live prices/news/AI
analysis. (When deploying to Vercel, add the same values under the project's
Settings → Environment Variables instead of this file.)

| Variable | Purpose | Required |
|---|---|---|
| `NVIDIA_API_KEY` | Stage 1 factual analysis (NVIDIA) | Required |
| `XAI_API_KEY` | Stage 2 character-tone rewrite (xAI Grok) | Required |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | Related news search (Naver News API) | Required |
| `KRX_AUTH_KEY` | Stock list and daily prices (KRX Open API) | Required |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | Intraday/period charts, PER/PBR/dividend/market cap (Korea Investment & Securities Open API) | Required |
| `NVIDIA_MODEL` / `XAI_MODEL` | Override the model used at each stage | Optional (has defaults) |
| `KIS_BASE_URL` | Override the KIS API base URL (default: production `openapi.koreainvestment.com:9443`) | Optional |

## Deployment

Connecting the GitHub repo to Vercel deploys it directly (it's a Next.js app,
so almost no extra configuration is needed). After deploying, add the
environment variables above to the Vercel project's Settings and redeploy for
them to take effect.
