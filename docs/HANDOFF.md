> **참고 (8/27 정리):** 이 문서는 2026-08-25 세션이 남긴 핸드오프 메모입니다. 이후 저장소 구조가 정리되어(backend/ -> data-pipeline/, prototype/ -> legacy-ui-mockup/ 등) 아래 경로 언급 중 일부는 최신 구조와 다를 수 있습니다. 최신 구조는 루트의 README.md를 참고하세요.

# Handoff notes (2026-08-25)

Written for whichever AI assistant picks this project up next. Read this before
touching code — it captures decisions made this session that aren't obvious
from the code alone.

## What this project is

`nescio` — a Next.js 16 (App Router, Turbopack) stock-briefing app aimed at
beginner Korean retail investors. Core idea: pick a stock, get an LLM-written
plain-language explanation ("가격이 움직인 이유") of why the price moved,
broken into causes with timelines, news citations, and bull/bear opinion
counts. Explanations are written at a 14-year-old's reading level, in 존댓말,
and explicitly avoid investment recommendations (see the system prompt in
`src/app/api/analyze/route.ts`).

Stack: Next.js 16.3.2, React 19, TypeScript, Tailwind v4. No test suite exists.

## Recent commits (this session)

- `426422e` — Added the whole app surface: onboarding (login/persona/sectors),
  watchlist, stock detail page with cause breakdown, alerts, my page, plus the
  three API routes and `src/lib` helpers.
- `a5ce87d` — Wired up 시가총액 (market cap) in the stock detail metrics row.

Both are pushed to `origin/main`. Working tree is otherwise clean except for
scratch files described below.

## Data sources / env vars

Env vars are **not** in a root `.env` — they live in `notebooks/.env` (an
older layout from before the Next.js app existed). `src/lib/server-env.ts`
reads `process.env` first, then falls back to manually parsing
`notebooks/.env`. If you add a root `.env`, `server-env.ts` still works
(process.env wins), but don't be surprised the values aren't where you'd
expect.

Vars in use: `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` (news search),
`XAI_API_KEY`/`XAI_MODEL` (LLM analysis, default model
`grok-4-1-fast-non-reasoning`), `KRX_AUTH_KEY` (KRX Open API).

**Important KRX API constraint**: the current `KRX_AUTH_KEY` is only
authorized for the `sto/stk_bydd_trd` endpoint (유가증권/코스닥 일별매매정보 —
daily close price, change rate, market cap). We confirmed by direct curl call
that `sto/stk_isu_base_info` returns `401 Unauthorized API Call` on this key,
and there is no dedicated PER/PBR/배당수익률 endpoint in KRX's official Open
API service list at all (checked openapi.krx.co.kr's service listing). The
only known way to get PER/PBR/dividend yield is the unofficial
`data.krx.co.kr` JSON endpoint that `pykrx` scrapes (no auth key, not an
official API, could break anytime) — the user explicitly declined to use that
approach for now. **Do not silently wire up PER/PBR from an unofficial
scrape** — ask first if you're picking this back up.

## Known gaps (intentionally left, not bugs)

In `src/app/stock/[ticker]/page.tsx`:

1. **Price chart** — `<div className="placeholder-box">가격 차트</div>` is
   literally just text, no chart library, no data fetch. The range tabs
   (1일/1주/1개월/1년) update local state (`range`) but nothing reads it yet.
2. **PER / PBR / 배당** in `MetricsRow` — still render `—`. Market cap in the
   same row *is* wired (see below). See the KRX constraint above before
   trying to fill these in.

   **Update (2026-08-26): out of MVP scope by product decision, not just
   blocked by the API gap.** PER/PBR/dividend yield are valuation/screening
   metrics — they don't feed the app's core loop (explain *why* the price
   moved today), so they don't fit the concept even if the data source
   problem got solved. Leave the `—` placeholders as-is; don't spend time
   re-attempting the KRX permission request or the unofficial scrape path
   unless the product scope explicitly changes.

## What IS wired up

`MKTCAP` was already present in the `stk_bydd_trd` response we fetch for
price data — it was just unused. `src/lib/krx.ts` now parses it into
`marketCap` on the `Price` type (`src/lib/types.ts`), and
`src/lib/format.ts` has `formatMarketCap()` (조/억 formatting). Flows through
`getPriceForTicker`, `getPricesForTickers`, the `/api/analyze` route, and
`MetricsRow` in the stock detail page.

## Files that exist locally but are deliberately NOT committed

- `session_cell_2.py`, `session_cell_3.py`, `session_cell_4.py` (repo root) —
  scratch copies of the SK Hynix stock-analysis code (KIS/Naver/xAI), content
  duplicates what's already in `prototype/1st prototype.ipynb`. Left alone at
  the user's choice; not part of the app.
- `prototype/1st prototype.ipynb.py` — **not source code**. It's a JSON dump
  of Antigravity editor's language-server diagnostics/state, which happens to
  be named like a notebook export. Safe to delete if it's in the way; do not
  treat it as real code.
- `prototype/__pycache__/` — Python bytecode cache, now gitignored.

## Verifying changes

- `npx tsc --noEmit` — type check
- `npx next build` — full build (also runs TS)
- `npx eslint src` — lint **only** `src/`; running bare `npx eslint .` also
  scans `.venv/Lib/site-packages/matplotlib/...` (a Python venv, not
  gitignored) and reports unrelated errors from vendored JS in there. Not a
  real problem, just don't let it confuse you — `.venv` isn't excluded from
  eslint yet.

## Style/process notes from this session

- The user reviews what's staged before committing; untracked files that look
  like editor artifacts or scratch work get flagged and excluded rather than
  bulk-added.
- Ambiguous data-source or architecture decisions (e.g. official API vs.
  unofficial scrape) were surfaced as explicit questions rather than assumed
  — keep doing that for judgment calls with real tradeoffs (reliability,
  ToS risk).
