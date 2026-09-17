> **참고 (9/15 정리):** 아래에 2026-09-15 세션이 남긴 새 섹션을 맨 위에 추가했습니다. 그 아래
> 2026-08-25 메모는 이후 저장소 구조가 정리되어(backend/ -> data-pipeline/, prototype/ ->
> legacy-ui-mockup/ 등) 경로 언급 일부가 최신 구조와 다를 수 있습니다. 최신 구조는 루트의
> README.md를 참고하세요.

# Handoff notes (2026-09-15) — 공모주(IPO) 화면 신규 구현

이 세션에서 한 일을 요약합니다. 다음에 이 프로젝트를 이어받는 AI 어시스턴트는 이 섹션부터
읽으세요. `docs/HANDOFF.md` 아래쪽에 8/25 세션 메모가 그대로 남아있고, KIS/KRX 관련 세부
제약사항은 여전히 유효하니 참고하세요.

## 무엇을 새로 만들었나 — DART 기반 공모주(IPO) 청약 캘린더

새 화면 `/ipo`: 금융감독원 OpenDART "증권신고서(지분증권)" 공시를 파싱해서 진행 중/예정
공모주 목록을 보여줍니다. 카드를 펼치면 주관사, 공모 규모, 공모 주식수, 상장 예정일(추정),
**증권사별 배정 주식수**(9/15 마지막 작업)까지 표시됩니다.

- `src/lib/dart.ts` (신규) — DART `list.json`(공시검색)·`estkRs.json`(지분증권 상세) 2단계 호출
- `src/lib/types.ts` — `IpoInfo`, `UnderwriterAllocation` 타입 추가
- `src/app/api/ipos/route.ts` (신규) — 30분 캐시, `DART_API_KEY` 없으면 502
- `src/app/ipo/page.tsx` (신규) — 카드 리스트 + 펼침 상세
- `src/components/BottomNav.tsx` — "공모주" 탭 추가
- `README.md` — `DART_API_KEY` 환경변수 문서화 완료(신청: opendart.fss.or.kr, 무료·이메일 인증만)

## DART API 관련 — 실측으로 확인된 함정들 (문서만 보고는 모르는 것들)

실제 응답(빅웨이브로보틱스, corp_code 01722066)으로 확인한 내용이라 신뢰도 높음:

1. **`pblntf_detail_ty=C001`이 서버에서 실제로 필터링되지 않음** — 채무증권/파생결합증권/
   투자설명서 같은 게 섞여 나옵니다. `report_nm`에 "증권신고서"와 "지분증권"이 둘 다 포함된
   것만 클라이언트에서 걸러야 합니다(`isEquityRegistrationTitle`).
2. **`sbd`(청약기일) 필드가 한글 날짜 포맷** — `"2026년 09월 15일 ~ 2026년 09월 16일"`처럼
   옵니다. 점/슬래시/대시 구분자만 매칭하는 정규식으로는 조용히 실패합니다.
   `parseSubscriptionRange`의 정규식이 `[.\-/년]`/`[.\-/월]`을 같이 매칭하게 되어있으니
   건드릴 때 주의하세요.
3. **`estkRs.json`(상세조회)의 `bgn_de`/`end_de` 윈도우가 `list.json`(목록조회)과 다르게
   동작** — 목록조회는 60일 윈도우로 충분히 걸리는 회사인데도, 상세조회를 같은 60일 윈도우로
   호출하면 `"013"`(no data)이 나올 수 있습니다(정정공시 때문에 원 접수일이 훨씬 이전일 수
   있는 듯). 그래서 `fetchUpcomingIpos`는 목록조회용 `bgnDe`(60일)와 상세조회용
   `detailBgnDe`(730일, 2년) 윈도우를 따로 계산해서 씁니다. 이걸 하나로 합치면 실제 존재하는
   공모주가 조용히 목록에서 빠집니다.
4. **같은 회사가 초안/[정정]/[발행조건확정] 여러 건으로 잡힘** — `corp_code` 기준으로
   dedupe하되, `rcept_no`(접수번호, 날짜+일련번호라 문자열 비교로 최신 판단 가능)가 가장 큰
   것만 남겨야 합니다. `searchIpoCandidates`가 이 로직입니다.
5. **`estkRs.json`의 `group` 배열은 그룹마다 같은 필드명(`exprc`/`expd` 등)을 다른 의미로
   재사용** — 예: 일반사항 그룹의 `exprc`/`expd`와 일반청약자환매청구권 그룹의 `exprc`/`expd`는
   전혀 다른 값입니다. 그냥 평탄화해서 읽으면 안 되고, `findGroupRows(data, "그룹제목")`으로
   그룹을 먼저 좁힌 다음 읽어야 합니다.
6. **인수인정보 그룹 필드**: `actsen`=인수인구분(대표/공동), `actnmn`=인수인명(증권사명),
   `udtcnt`=인수수량(=사실상 그 증권사의 배정주식수), `udtamt`=인수금액. `udtcnt`가 오늘 추가한
   "증권사별 배정 주식수" 기능의 데이터 소스입니다.
7. **DART엔 기관투자자 수요예측 결과(경쟁률·참여기관수 등)를 위한 구조화 API가 없습니다**
   (DS006 카테고리엔 지분증권/채무증권/증권예탁증권/합병/포괄적교환이전/분할 6개뿐). 있으려면
   공시 원문 문서(HTML/표)를 직접 파싱해야 하는데 불안정합니다. 사용자에게 트레이드오프를
   설명하고 `AskUserQuestion`으로 물어봤고, "불안정해도 시도"를 선택했지만 그 직후 "일단
   증권사 배정주식수부터"로 범위를 좁혀서 — **문서 파싱은 아직 착수 전**입니다. 다음에 이걸
   다시 물어보면 DART 공시 뷰어(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<rcept_no>`)
   원문을 열어서 표 구조부터 확인하는 게 출발점입니다. (WebFetch가 이 URL엔 provenance 제약
   때문에 바로 안 먹히니, 사용자에게 URL을 주고 직접 열어서 결과를 붙여넣어 달라고 요청하는
   방식이 이 세션에서 먹혔습니다.)

## 해외지수(니케이225/상해종합/심천종합/항셍지수) 연동 — 9/15, 코드 미검증

홈 화면 지수 스트립에 코스피/코스닥 옆으로 중국(상해·심천·항셍)·일본(니케이225) 지수를
추가했습니다. `src/lib/kis.ts`의 `fetchOverseasIndices()` — KIS `inquire-time-indexchartprice`
(tr_id `FHKST03030200`, `FID_COND_MRKT_DIV_CODE=N`) 사용.

**주의:** 종목 코드 중 `SPX`(S&P500)만 KIS 공식 예제로 확인됐고, 니케이225/상해/심천/항셍용으로
쓴 `N225`/`SHCOMP`/`SZCOMP`/`HSI`는 **추측값**입니다(GitHub `koreainvestment/open-trading-api`,
`Soju06/python-kis` 리포까지 뒤져봤지만 공식 코드표를 못 찾음). 실패해도 그 지수만 조용히
안 뜨게 방어 처리는 해뒀습니다(`try/catch` → `null` → 필터링). 사용자가 배포 후 실제 값이
맞는지 확인해야 하고, 틀렸으면 코드만 바꾸면 됩니다.

## 검증 상태 (9/15 세션 종료 시점)

- IPO 관련 파일 전부 `npx tsc --noEmit`/`npm run lint`/`npm run build` 통과 확인.
- 증권사별 배정주식수(`underwriterAllocations`) 기능까지 포함해 전부 로컬 컴퓨터
  (`C:\Users\홍준기\Desktop\nescio`)에 반영 완료. **커밋/푸시는 사용자가 직접 해야 함** — 이
  클라우드 세션의 git은 구조적으로 push가 막혀있음(알려진 제약, HANDOFF 하단 8/25 메모와 무관한
  이 세션만의 특성이 아니라 매 세션 공통).
- 해외지수 종목 코드(N225/SHCOMP/SZCOMP/HSI)는 배포 후 실제 값 검증 필요 — 위 섹션 참고.

## 다음 단계 후보 (이 세션 기준)

1. 해외지수 4종이 실제로 뜨는지, 값이 맞는지 배포 후 확인 (코드가 틀렸으면 KIS 문서/예제에서
   맞는 코드 다시 찾아야 함)
2. 공모주 기관투자자 수요예측/경쟁률 — DART 공시 원문 파싱 (사용자가 이미 "불안정해도 시도"
   의사는 밝혔으나 착수 전, 위 7번 항목이 시작점)
3. `/ipo` 화면이 실제 배포 환경에서 진행 중 공모주를 제대로 보여주는지, 중복 없이/누락 없이
   나오는지 최종 확인 (이번 세션에서 로컬로는 검증했지만 Vercel 배포 후 최종 확인 요청드린 상태)

---

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

## Known gaps

**Update (2026-08-27): the two gaps below are now wired via the KIS
(한국투자증권) Open API — `src/lib/kis.ts`.** `KIS_APP_KEY`/`KIS_APP_SECRET`
were already in `notebooks/.env`. KIS is an official authenticated API (not
the unofficial `data.krx.co.kr` scrape the earlier note warned against), so
the "ask first" concern doesn't apply.

1. **Price chart** — DONE. `src/components/PriceChart.tsx` renders a Recharts
   area chart for all four tabs. `GET /api/price-history?ticker&range`:
   - `1일` → KIS 분봉 `inquire-time-dailychartprice` (FHKST03010230), 4
     paginated calls (120 one-min bars each, anchors 11:00/13:00/15:00/15:30).
     This endpoint also serves past-day minute bars (KIS keeps ~1yr), so
     `fetchIntradayHistory` walks back up to 5 days to show the **last
     trading day** on weekends/holidays instead of an empty chart.
   - `1주`/`1개월` → KIS `inquire-daily-itemchartprice` (FHKST03010100),
     daily candles, one call. `1년` → same endpoint, weekly candles (the
     100-row/call cap rules out a year of dailies). Falls back to the old
     KRX per-weekday loop if KIS fails.
2. **PER / PBR / 배당 / 시가총액** in `MetricsRow` — DONE via
   `GET /api/valuation?ticker`:
   - `inquire-price` (FHKST01010100): `per`, `pbr`, `eps`, `bps`,
     `hts_avls` (시가총액, 억원 → ×1e8), `stck_prpr` (현재가).
   - 배당수익률: `inquire-price` has no dividend field, so
     `fetchDividendYield` sums per-share cash dividends **paid in the last
     12 months** from `ksdinfo/dividend` (TR `HHKDB669102C0`, filtered by
     `SHT_CD`) and divides by `stck_prpr`. KIS's own `divi_rate` is a
     par-value ratio, not a yield — don't use it. Rows with an empty
     `divi_pay_dt` (amount-TBD announcements, `per_sto_divi_amt` "0") are
     skipped. Non-fatal: any failure → `null` → renders `—`.
   Note: the live KIS dataset this was tested against has inflated prices
   (Samsung ~266k, SK Hynix ~1.77M) so some computed yields look tiny — the
   math is right; real-priced tickers (Kia 5.4%, KB 2.9%) check out.

KIS notes: OAuth token (`/oauth2/tokenP`) lasts 24h, issue limited to ~1/min
— cached in memory + `.kis_token_cache.json` (gitignored). Per-appkey
"초당 거래건수" limit (EGW00201) is strict; all calls are serialized through
a ~300ms throttle in `kis.ts` with retry/backoff. Responses cached in-memory
60s (charts) / 10min (valuation). Cold `1일` load ≈ 1.7s; everything else <1s.

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
