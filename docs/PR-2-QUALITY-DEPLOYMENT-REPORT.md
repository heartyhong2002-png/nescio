# PR #2 품질·배포 최종 검증 보고서

검증일: 2026-09-29  
대상: GitHub PR #2 `fix-valuation`  
실제 GitHub 방향: `main` → `fix-valuation-retry` (역방향으로 확인되어 GitHub 웹에서 Closed 완료)  
최종 코드 검증: `main` 브랜치에서 통과
판정: **🟡 코드·CI 게이트 통과, 운영 상태 재검증 필요**

> 이 보고서는 PR #2 배포 차단 항목(P0/P1/P2)의 수정 및 실시간 검증 완료 기록이다.
> 비밀값은 조회하거나 기록하지 않았고, 환경변수는 존재 여부와 문서 일치 여부만 점검했다.

## 1. 배포 게이트 최종 결과

| 우선순위 | 항목 | 결과 | 조치 내용 및 검증 결과 |
| --- | --- | --- | --- |
| P0 | DB 백업 워크플로 | **해결 (통과)** | 30일 초과 백업 prune, `git add/commit/push`, `contents: write`, `concurrency`, `set -euo pipefail` 적용. mock pg_dump 및 30일 prune 테스트(`tests/db-backup.test.mjs`) 통과. |
| P0 | `db-backups` 산출물 | **미검증** | workflow 코드와 mock 테스트는 통과했지만, 현재 브랜치에는 SQL 덤프가 없다. 실제 dispatch·commit·push 성공을 확인해야 한다. |
| P1 | 인증 세션 갱신 | **해결 (통과)** | `src/proxy.ts`에 `copySessionHeaders()` 구현. 세션 갱신 redirect 시 `Set-Cookie` 및 `Cache-Control` 보존. 만료 access token + 유효 refresh token E2E 테스트(`tests/proxy-auth.test.mjs`) 통과. |
| P1 | 실제 DB 스키마와 코드·문서 | **해결 (통과)** | `docs/migrations/v001_schema_normalization.sql`을 실제 운영 DB에 반영 완료 (`stock_analyses` 컬럼 `name` → `stock_name`, `created_at` 추가, `handle_new_user()` RPC 외부 실행 권한 취소, RLS `(select auth.uid())` 및 `WITH CHECK` 적용). |
| P1 | 비용 발생 API | **해결 (통과)** | `macro`, `consensus`에 IP 기반 rate limit(10 req/min, 429), in-flight Promise deduplication, TTL 캐시, ticker 영숫자 검증, 에러 메시지 마스킹 적용. `market-indices`(30 req/min), `watchlist-summary`(15 req/min) 레이트리밋 적용. 20개 동시 요청 deduplication(공급자 1회 호출) 테스트(`tests/cost-apis.test.mjs`) 통과. |
| P1 | 공급망 보안 | **해결 (통과)** | Next.js `16.3.7`, undici `8.11.2`로 보안 패치 완료. `npm audit --omit=dev` 결과 취약점 0건. |
| P1 | CI 파이프라인 | **해결 (통과)** | `.github/workflows/ci.yml` 신설. PR 및 push 시 lint, tsc, automated tests, build를 일괄 실행. GitHub Actions 실행 결과 `conclusion: success` 확인. |
| P2 | valuation 해설 캐시·히스토리 | **해결 (통과)** | 캐시 키에 ticker, 정규화된 종목명, 지표, 반올림 현재가, 등락률, 모델 버전 포함. 사용자 히스토리에 현재가 스냅샷(`metrics.currentPrice`) 보존. 다중 사용자 가격별 격리 테스트(`tests/valuation-isolation.test.mjs`) 통과. |
| P1 | Supabase 유출 비밀번호 보호 | **미해결** | 실제 Security Advisor에서 leaked password protection 비활성 경고가 남아 있다. Dashboard 설정이 필요하다. |
| P2 | `stock_analyses` 중복 RLS 정책 | **해결 (통과)** | 이전 ALL 정책을 v002로 제거했다. 실제 정책에는 소유자 select/insert만 남았고 RLS init-plan·multiple policy 경고가 사라졌다. |

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

---

## 4. 후속 운영 검증 (2026-09-29)

- 실제 `db-backups` 브랜치에는 아직 `.gitkeep`만 있다. `workflow_dispatch`로 덤프·30일 정리·commit·push의 성공을 실제로 확인하기 전에는 백업 복구 가능성을 보장할 수 없다.
- `stock_analyses: 본인만` 중복 ALL 정책은 운영 DB에서 제거했고, 재현 가능한 SQL은 [v002 migration](./migrations/v002_remove_legacy_stock_analyses_policy.sql)에 남겼다. 실제 정책에는 소유자 select/insert만 남았으며 RLS 관련 Advisor 경고도 해소됐다.
- Supabase가 추적하는 migration history에는 v002만 기록돼 있다. v001은 직접 SQL로 반영된 이력이므로, 이후에는 표준 migration history와 저장소 파일을 함께 관리해야 한다.
- Supabase Auth의 leaked password protection은 코드나 SQL이 아닌 Dashboard 보안 설정이다. 현재 Advisor가 비활성 경고를 내므로 활성화가 필요하다.
- 다른 AI에 전달할 운영 마무리 지시는 [POST-DEPLOYMENT-HARDENING-PROMPT.md](./POST-DEPLOYMENT-HARDENING-PROMPT.md)를 사용한다.

---

## 후속 배포 확인 (2026-10-22)

| 항목 | 결과 | 근거 및 남은 작업 |
| --- | --- | --- |
| 앱 Production 브랜치 | **통과 (설정 확인)** | Vercel `nesio` 프로젝트의 Production 환경은 이미 `main`을 추적한다. 이번 `db-backups` 실패는 Preview 환경이다. |
| `db-backups` Vercel 빌드 실패 원인 | **원인 확인** | `origin/db-backups`에는 `README.md`와 `backups/`만 있고 `package.json`이 없는 백업 전용 브랜치다. Vercel의 Next.js 감지가 실패한 이유와 일치한다. |
| Vercel Ignored Build Step | **설정 저장 확인** | 프로젝트 설정에 `db-backups`는 exit 0(건너뜀), 다른 브랜치는 exit 1(빌드 진행)인 조건을 저장했다. Production Branch나 Root Directory는 변경하지 않았다. |
| 규칙 실행 결과 | **미검증** | 기존 실패 Preview의 재배포를 Ignore Build Step 적용 옵션과 함께 요청하고 생성 알림을 확인했지만, 새 배포의 최종 상태는 확인하지 못했다. 새 `db-backups` push 시 무시/취소 결과와 일반 앱 브랜치 빌드를 확인해야 한다. |
| 공모주 첫날 성적표 변경 | **코드 변경 및 테스트 통과** | 2026 데이터만 포함, 첫날 종가 기준 정확한 +100%/+300% 경계, UI 기준 표기 및 회귀 테스트. 테스트 당시 17개 통과, lint·tsc·build 통과. 실서비스 원본 데이터 대조는 미실시이며 작업 트리 기준 재검증이 필요하다. |

현재 배포 판정은 이 표의 미검증 항목이 해소될 때까지 **운영 상태 확인 중**이다. 이 항목만으로 이전 PR #2 검증 결과나 현재 Production 상태를 새로 보증하지 않는다. 전체 인계는 [AI-HANDOFF-PROMPT.md](./AI-HANDOFF-PROMPT.md)를 참고한다.
