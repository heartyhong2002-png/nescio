# Nescio 다음 AI 인수인계 프롬프트

아래 내용을 다른 AI 코딩 도구에 전달해 현재 상태에서 작업을 이어가세요. 이 프롬프트는 2026-10-22 기준이며, 시작할 때 반드시 실제 저장소·대시보드 상태를 다시 확인하세요.

```text
당신은 Nescio 프로젝트의 풀스택 개발 및 품질·배포 담당자입니다. 아래 기록을 바탕으로 현재 작업을 이어가되, 기록을 무조건 사실로 간주하지 말고 실제 상태와 대조하세요.

## 먼저 지킬 사항

1. 저장소에서 `git status --short --branch`, `git log -1 --oneline`, 관련 파일 diff를 읽으세요. 사용자의 미커밋·미추적 파일을 삭제, 초기화하거나 요청 범위와 무관하게 stage/commit/push하지 마세요. 요청 범위의 작업이 끝나면 사용자의 선호에 따라 변경 파일만 선택적으로 commit/push하세요.
2. 비밀값은 절대 읽거나 출력·복사·기록하지 마세요. 환경변수/Secret은 값이 아닌 존재 여부만 확인하세요.
3. 이 프로젝트의 Next.js 16에는 breaking changes가 있습니다. 코드 작성 전에 `AGENTS.md` 지침에 따라 관련 `node_modules/next/dist/docs/` 가이드를 읽으세요.
4. 기존 UI/API 계약을 불필요하게 바꾸지 말고, 요청이 진단이면 수정하지 말고 결과와 최소 수정안을 제시하세요.
5. 외부 서비스의 상태는 실제 화면/도구로 확인한 경우에만 확인했다고 말하세요. 배포·운영 상태를 추정으로 통과 처리하지 마세요.

## 프로젝트 개요

- 주식·공모주·매크로 정보를 제공하는 Nescio 웹 앱.
- Next.js 16 App Router + React 19 + TypeScript 5 + Tailwind CSS v4 + Supabase Auth/Postgres.
- 저장소: `heartyhong2002-png/nescio`; 기준 브랜치 `main`.
- 실제 배포 프로젝트 이름은 Vercel에서 `nesio`로 표시된다.
- 현재 주요 구현: 주식 분석/차트/컨센서스, 공모주(`/ipo`), 매크로/환율, watchlist, Supabase RLS, 다중 뉴스 소스.

## 기록된 최신 Git 및 작업 트리 (2026-10-22)

- 확인 당시 `main`과 `origin/main`은 `3a9494c feat: enrich IPO subscription and demand data`에서 일치했다. 작업 시작 시 다시 확인하세요.
- 인계 당시 미커밋/미추적 파일은 다음이었지만 이 목록은 오래됐을 수 있습니다. 현재 목록과 비교하고 사용자의 변경을 보존하세요.
  - 수정: `README.md`, `docs/HANDOFF.md`, `docs/PR-2-QUALITY-DEPLOYMENT-REPORT.md`, `docs/SUPABASE.md`, `package.json`, `package-lock.json`, `src/lib/ipo-listings.ts`
  - 미추적: `docs/AI-HANDOFF-PROMPT.md`, `docs/POST-DEPLOYMENT-HARDENING-PROMPT.md`, `docs/migrations/v002_remove_legacy_stock_analyses_policy.sql`, `src/lib/ipo-grading.ts`, `tests/ipo-grading.test.mjs`, `graphify-out/`, `근본ui.make`
  - `README.md`에 새 프롬프트 링크가 있는 변경은 이 문서 작업 중 관찰됐지만, 이번 AI는 README를 편집하지 않았습니다. 작업 전 현재 diff를 확인하세요.

## 최근 공모주 성적표 작업

- 사용자가 `/ipo`의 “2026 상장 현황 & 첫날 성적표”에서 첫날 성적 기준이 이상하다고 지적했다.
- 당시 수정은 `src/lib/ipo-listings.ts`에서 2026 상장일만 포함, 공모가 대비 첫날 종가 수익률로 분류, `TRIPLE >= +300%`, `DOUBLE >= +100%`, `PROFIT >= 0%`, `LOSS < 0%`, 통계에도 동일 badge 사용으로 정리했다.
- 판정 함수는 `src/lib/ipo-grading.ts`, 테스트는 `tests/ipo-grading.test.mjs`; UI 열 이름은 “첫날 성적 (종가 기준)”이다.
- 이 기준은 합리적인 구현 가정으로 적용했으며 사용자가 원하는 사업상 기준이나 실제 38커뮤니케이션의 각 레코드와는 대조되지 않았다. 추후 관련 변경이면 종가 기준 자체를 필요 시 사용자에게 확인하고, 경계 테스트를 유지하세요.
- 변경 시점의 검증 결과: `npm test` 17개 통과, `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과. 이후 작업 트리 변경은 재검증하지 않았으므로 현재 기준으로 다시 확인하세요.

## 최근 Vercel 오류 및 적용 조치 — 미완료 검증

- 로그의 실패는 `db-backups` 브랜치 `89f6ecf` (`backup: 2026-10-13 public schema (UTC)`)를 Preview로 빌드하면서 발생한 “No Next.js version detected”였다.
- Git에서 본 `origin/db-backups`는 의도적인 백업 전용 orphan 브랜치로 `README.md`, `backups/`만 있으며 앱의 `package.json`은 없다. 앱 소스를 이 브랜치에 복사하거나 병합하지 마세요.
- Vercel `nesio` 프로젝트의 Production tracking branch는 이미 `main`; Preview는 모든 unassigned Git branches를 추적했다. 이 오류 배포는 Preview였다. Production branch 변경은 불필요했다.
- Vercel Project Settings → Build and Deployment → Ignored Build Step에 아래 custom command를 저장했다.
  `if [ "$VERCEL_GIT_COMMIT_REF" = "db-backups" ]; then exit 0; else exit 1; fi`
  Vercel 기준 exit 0은 빌드 무시, exit 1은 빌드 진행이다. 그래서 `db-backups`만 건너뛰고 다른 브랜치는 계속 빌드하도록 의도했다.
- 저장된 명령은 UI에서 확인했다. 기존 실패 Preview 재배포를 “Use project's Ignore Build Step” 체크 상태로 요청했고 “Deployment created” 알림은 봤지만, 새 요청의 terminal status는 확인하지 못했다. 따라서 저장은 확인, 동작은 미검증이다.
- 다음으로 Vercel 배포 목록에서 실제 재시도/최신 `db-backups` 항목을 확인하고, 빌드 오류 대신 Ignore/Cancelled 상태인지 확인하세요. 새 `main` 빌드가 필요한지 먼저 확인하되 Production 배포를 임의로 재실행하지 마세요. 오류가 계속되면 project-level 명령 적용 여부와 `VERCEL_GIT_COMMIT_REF` 전달 여부를 확인하고, 원인 증거 없이 새 설정을 추가하지 마세요.
- 무시된 Preview가 Vercel에 취소된 deployment 레코드로 남을 수 있습니다. 이를 정상적인 앱 배포 성공과 혼동하지 마세요.

## 종목 AI 브리핑과 뉴스 현재 동작

- `/api/analyze`는 NVIDIA `nvidia/nemotron-3-super-120b-a12b` 1단계 사실 분석 → Groq
  `openai/gpt-oss-120b` 2단계 쩐형 재작성 순서다. 각 단계는 Gemini `gemini-3.8-flash`로
  폴백하며, 모든 제공자가 실패하면 시세·뉴스 기반 규칙형 대체 브리핑을 반환한다.
- 뉴스는 네이버 최대 100건, Kakao Daum 웹문서 검색(`site:v.daum.net`), Google News RSS,
  한국경제·아시아경제 RSS를 병렬 집계한다. 최종 응답 상한은 40건이며, LLM 입력은
  `MAX_ANALYSIS_NEWS = 10`으로 제한된다. 화면 뉴스 수와 AI 입력 뉴스 수를 혼동하지 않는다.
- `sessionStorage` → 서버/Supabase `stock_analyses` 순으로 브리핑 캐시를 재사용한다. 10분
  이내 결과는 즉시 반환하고, 10분~24시간 stale 결과는 먼저 반환한 뒤 Next.js `after()`에서
  백그라운드 갱신한다. 단일 LLM은 약 10초, 부가 데이터는 약 6초, 영속 캐시는 약 3초 제한이다.
- OpenRouter/Qwen/xAI는 현재 종목 브리핑 경로에서 사용하지 않는다. Vercel 504 방지를 위해
  느린 외부 소스는 격리하고, 비 JSON 오류와 AI 제공자 실패 대체 결과는 클라이언트에서 안전하게 처리한다.

## 종목 AI 브리핑과 뉴스 현재 동작

- `/api/analyze`는 NVIDIA `nvidia/nemotron-3-super-120b-a12b` 1단계 사실 분석 → Groq
  `openai/gpt-oss-120b` 2단계 쩐형 재작성 순서다. 각 단계는 Gemini `gemini-3.8-flash`로
  폴백하며, 모든 제공자가 실패하면 시세·뉴스 기반 규칙형 대체 브리핑을 반환한다.
- 뉴스는 네이버 최대 100건, Kakao Daum 웹문서 검색(`site:v.daum.net`), Google News RSS,
  한국경제·아시아경제 RSS를 병렬 집계한다. 최종 응답 상한은 40건이며, LLM 입력은
  `MAX_ANALYSIS_NEWS = 10`으로 제한된다. 화면 뉴스 수와 AI 입력 뉴스 수를 혼동하지 않는다.
- `sessionStorage` → 서버/Supabase `stock_analyses` 순으로 브리핑 캐시를 재사용한다. 10분
  이내 결과는 즉시 반환하고, 10분~24시간 stale 결과는 먼저 반환한 뒤 Next.js `after()`에서
  백그라운드 갱신한다. 단일 LLM은 약 10초, 부가 데이터는 약 6초, 영속 캐시는 약 3초 제한이다.
- OpenRouter/Qwen/xAI는 현재 종목 브리핑 경로에서 사용하지 않는다. Vercel 504 방지를 위해
  느린 외부 소스는 격리하고, 비 JSON 오류와 AI 제공자 실패 대체 결과는 클라이언트에서 안전하게 처리한다.

## PR #2 / Supabase 보안 관련 기존 인계

- PR #2(`fix-valuation`)는 방향이 `main` → `fix-valuation-retry`인 역방향 PR로 확인돼 Closed 처리됐다고 기록돼 있다. 현재 PR 상태가 다시 필요하면 GitHub에서 읽기 전용 확인하세요.
- 코드 측에는 `src/proxy.ts`에서 세션 갱신 redirect의 `Set-Cookie` 및 `Cache-Control`을 보존하는 로직, 비용 발생 API의 인증/rate-limit/cache/deduplication, valuation 해설 캐시 키 분리, CI 검사가 추가됐다고 기록돼 있다. 재작업 전에 코드를 확인하세요.
- Supabase `v001_schema_normalization.sql`은 운영 DB에 직접 반영됐고 migration history 추적은 불완전하며, v002는 `stock_analyses`의 중복 ALL 정책 제거에 사용됐다고 기존 문서에 기록돼 있다. DB에 migration을 다시 적용하지 말고 먼저 실제 migration history/Advisor를 읽기 전용 확인하세요.
- 기존 문서에는 leaked password protection 미해결, 실제 DB backup workflow dispatch 결과 미검증이라고 기록돼 있다. 해결되었다고 추정하지 말고 현재 상태를 확인하세요.
- 상세 이력: `docs/HANDOFF.md`, `docs/PR-2-QUALITY-DEPLOYMENT-REPORT.md`, `docs/SUPABASE.md`, `docs/POST-DEPLOYMENT-HARDENING-PROMPT.md`.

## 검증 및 마무리

- 코드 변경이 있으면 관련 테스트 후 `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`를 순서대로 실행하세요. 더 큰/민감한 변경이면 `npm audit --omit=dev`와 CI 상태도 확인하세요.
- 백업 SQL 내용은 열거나 출력하지 마세요. Actions에서 실행을 요청하기 전 Secret 존재를 확인할 때도 값은 조회하지 마세요.
- 종료 보고는 실행한 검사와 결과, 외부 상태 확인 여부, 남은 리스크, 배포 가능 여부를 구분하고 “통과 / 실패 / 미검증(사유)”로 기록하세요.
- 문서를 고쳤다면 `docs/HANDOFF.md`와 필요 시 `docs/PR-2-QUALITY-DEPLOYMENT-REPORT.md`를 함께 갱신하세요. 인계 프롬프트 자체도 실제 확인 결과와 다르면 업데이트하세요.
```
