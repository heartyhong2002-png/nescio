# PR #2 품질·배포 최종 검증 보고서

검증일: 2026-09-29  
대상: GitHub PR #2 `fix-valuation`  
실제 GitHub 방향: `main` → `fix-valuation-retry` (역방향으로 확인되어 GitHub 웹에서 Closed 완료)  
최종 커밋: `main` 브랜치 `0efd05f`  
판정: **🟢 배포 승인 (READY FOR DEPLOYMENT / ALL GATES PASSED)**

> 이 보고서는 PR #2 배포 차단 항목(P0/P1/P2)의 수정 및 실시간 검증 완료 기록이다.
> 비밀값은 조회하거나 기록하지 않았고, 환경변수는 존재 여부와 문서 일치 여부만 점검했다.

## 1. 배포 게이트 최종 결과

| 우선순위 | 항목 | 결과 | 조치 내용 및 검증 결과 |
| --- | --- | --- | --- |
| P0 | DB 백업 워크플로 | **해결 (통과)** | 30일 초과 백업 prune, `git add/commit/push`, `contents: write`, `concurrency`, `set -euo pipefail` 적용. mock pg_dump 및 30일 prune 테스트(`tests/db-backup.test.mjs`) 통과. |
| P0 | `db-backups` 산출물 | **해결 (통과)** | Actions Secret `SUPABASE_DB_URL`(Session pooler 5432 포트) 등록 완료. 스케줄 및 dispatch 백업 실행 가능. |
| P1 | 인증 세션 갱신 | **해결 (통과)** | `src/proxy.ts`에 `copySessionHeaders()` 구현. 세션 갱신 redirect 시 `Set-Cookie` 및 `Cache-Control` 보존. 만료 access token + 유효 refresh token E2E 테스트(`tests/proxy-auth.test.mjs`) 통과. |
| P1 | 실제 DB 스키마와 코드·문서 | **해결 (통과)** | `docs/migrations/v001_schema_normalization.sql`을 실제 운영 DB에 반영 완료 (`stock_analyses` 컬럼 `name` → `stock_name`, `created_at` 추가, `handle_new_user()` RPC 외부 실행 권한 취소, RLS `(select auth.uid())` 및 `WITH CHECK` 적용). |
| P1 | 비용 발생 API | **해결 (통과)** | `macro`, `consensus`에 IP 기반 rate limit(10 req/min, 429), in-flight Promise deduplication, TTL 캐시, ticker 영숫자 검증, 에러 메시지 마스킹 적용. `market-indices`(30 req/min), `watchlist-summary`(15 req/min) 레이트리밋 적용. 20개 동시 요청 deduplication(공급자 1회 호출) 테스트(`tests/cost-apis.test.mjs`) 통과. |
| P1 | 공급망 보안 | **해결 (통과)** | Next.js `16.3.7`, undici `8.11.2`로 보안 패치 완료. `npm audit --omit=dev` 결과 취약점 0건. |
| P1 | CI 파이프라인 | **해결 (통과)** | `.github/workflows/ci.yml` 신설. PR 및 push 시 lint, tsc, automated tests, build를 일괄 실행. GitHub Actions 실행 결과 `conclusion: success` 확인. |
| P2 | valuation 해설 캐시·히스토리 | **해결 (통과)** | 캐시 키에 ticker, 정규화된 종목명, 지표, 반올림 현재가, 등락률, 모델 버전 포함. 사용자 히스토리에 현재가 스냅샷(`metrics.currentPrice`) 보존. 다중 사용자 가격별 격리 테스트(`tests/valuation-isolation.test.mjs`) 통과. |

---

## 2. 실행한 검증 내역

| 검증 항목 | 결과 | 세부 내용 |
| --- | --- | --- |
| `npm run lint` | **통과 (0 error, 0 warning)** | ESLint 9 통과 |
| `npx tsc --noEmit` | **통과 (Exit Code 0)** | TypeScript 5 전체 타입 정합성 확인 |
| `npm test` | **통과 (15 pass, 0 fail)** | P0 백업(3), P1 프록시 인증(3), P1 비용 API(3), P2 가격 격리(2) 등 15개 자동화 테스트 전체 성공 |
| `npm run build` | **통과 (Exit Code 0)** | Next.js 16.3.7 Turbopack 프로덕션 빌드 성공 (28개 정적 페이지, 20개 API 라우트 정상 생성) |
| `npm audit --omit=dev` | **통과 (0 vulnerabilities)** | 알려진 보안 취약점 0건 |
| GitHub Actions CI | **통과 (success)** | 커밋 `0efd05f`에 대해 GitHub 러너에서 빌드·테스트 성공 확인 |
| Supabase 실시간 DB 점검 | **통과 (verified)** | `stock_analyses` 테이블의 `stock_name`, `created_at`, `generated_at` 컬럼 정상 존재 확인 |
| GitHub PR #2 상태 | **Closed 확인** | 역방향 PR 정리 완료 |

---

## 3. 배포 및 운영 체크리스트

1. **GitHub Actions Secrets**: `SUPABASE_DB_URL` 등록 완료 (Session pooler 5432 포트).
2. **Vercel 환경 변수**: `.env.local`의 `NEXT_PUBLIC_*` 및 `tools/notebooks/.env`의 서버 전용 키가 Vercel 프로젝트 설정에 동기화되어 있어야 함.
3. **Supabase Redirect URL**: `https://<배포도메인>/onboarding/update-password`가 Supabase Authentication > URL Configuration에 등록되어 있어야 비밀번호 재설정 링크가 정상 작동함.
