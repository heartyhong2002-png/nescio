# PR #2 품질·배포 검증 보고서

검증일: 2026-09-29  
대상: GitHub PR #2 `fix-valuation`  
실제 GitHub 방향: `main` → `fix-valuation-retry` (요청에 적힌 방향과 반대)  
판정: **배포 불가**

> 이 보고서는 코드 변경 제안이 아니라 검증 기록이다. 비밀값은 조회하거나 기록하지 않았고,
> 환경변수는 존재 여부와 문서 일치 여부만 점검했다.

## 배포 게이트

| 우선순위 | 항목 | 결과 | 근거 |
| --- | --- | --- | --- |
| P0 | DB 백업 워크플로 | 실패 | 덤프 뒤 30일 정리, Git commit, push가 구현되지 않았다. |
| P0 | `db-backups` 산출물 | 실패 | 브랜치는 초기화 커밋과 `backups/.gitkeep`만 있고 SQL 덤프는 없다. |
| P1 | 인증 세션 갱신 | 실패 | 리다이렉트가 `updateSession()`의 갱신 쿠키와 캐시 방지 헤더를 보존하지 않는다. |
| P1 | 실제 DB 스키마와 코드·문서 | 실패 | `stock_analyses`의 실제 컬럼과 API·문서가 다르며, 마이그레이션 이력도 없다. |
| P1 | 비용 발생 API | 실패 | macro·consensus에 공개 요청 제한, 입력 검증, in-flight 중복 제거가 없다. |
| P1 | 공급망 보안 | 실패 | `npm audit --omit=dev`가 Next.js 치명적 권고 2건과 undici 권고 1건을 보고했다. |
| P1 | CI | 실패 | PR lint/build/test를 강제하는 워크플로가 없다. |
| P2 | valuation 해설 캐시·히스토리 | 실패 | 이름·현재가·등락률이 캐시 키에서 빠지고, 전역 캐시 적중 시 두 번째 사용자의 히스토리가 저장되지 않는다. |

## 실행한 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | 통과 | 현재 작업 폴더 기준 |
| `npm run build` | 통과 | 현재 작업 폴더 기준 |
| 안전한 로컬 스모크 | 통과 | 비로그인 `/my`는 307, 잘못된 valuation/price-history 입력은 400, 비로그인 valuation 해설은 401 |
| `npm audit --omit=dev` | 실패 | Next.js는 최소 16.3.7 이상으로 업데이트 필요 |
| `git diff --check` | 실패 | PR 변경에 trailing whitespace가 있다 |
| 실제 Supabase RLS 구조 | 부분 통과 | 4개 대상 테이블에 RLS와 소유자 조건이 있다. 실제 두 사용자 교차 접근은 미실행 |
| 실제 Supabase 보안·성능 Advisor | 실패/개선 필요 | 공개 `SECURITY DEFINER` 함수, 유출 비밀번호 보호 비활성, RLS policy init-plan 경고 |

격리 워크트리에서의 재빌드는 의존성 설치 중 npm `ENOTEMPTY` 오류로 완료하지 못했다. 따라서
린트·빌드 통과는 현재 작업 폴더의 결과이며, 깨끗한 PR 헤드 재검증은 수정 뒤 다시 해야 한다.

## 파일별 상세

### `.github/workflows/db-backup.yml` — P0 실패

- `pg_dump`는 수행하지만 `find`만 실행한다. `backups/*.sql`의 30일 초과 파일을 삭제하지 않는다.
- `git add`, commit, push와 `permissions: contents: write`가 없다. 수동 실행이 성공해도
  `db-backups`에 오늘의 덤프를 남길 수 없다.
- schedule과 수동 실행이 겹칠 때의 경합 방지(`concurrency`)가 없다.
- `date -u`를 사용한다. "당일"이 한국 시간 기준이면 파일 날짜가 새벽 실행 시 하루 전으로 기록된다.
- Git tip에서 파일을 삭제해도 과거 커밋에는 데이터가 남는다. 30일 보존을 개인정보 삭제 의미로
  사용하려면 Git 이력 보관은 적합하지 않다. 접근 통제가 된 암호화 백업 저장소와 별도 보존 정책이 필요하다.

### `src/proxy.ts`, `src/lib/supabase/middleware.ts` — P1 실패

- middleware는 세션 갱신 쿠키를 정상 생성하지만, proxy가 `NextResponse.redirect()`를 새로
  반환하며 기존 response의 쿠키를 복사하지 않는다.
- 최신 Supabase SSR 지침상 `setAll`이 전달하는 캐시 방지 헤더도 response에 적용해야 한다.
- 재현: 만료 access token과 유효 refresh token으로 `/onboarding/login` 또는
  `/onboarding/reset-password`에 접근하면 갱신된 세션이 브라우저에 기록되지 않을 수 있다.
- 수정 뒤에는 테스트 계정에서 로그인 페이지 진입 → 홈 이동 → `/my` 접근까지 쿠키와 redirect를
  포함한 E2E를 수행한다.

### `src/app/api/analyze/route.ts`, `docs/supabase-schema.sql` — P1 실패

- 실제 `stock_analyses`는 `name`, `tone`, `generated_at`을 사용하고 `created_at`이 없다.
- API와 문서는 `stock_name`, `created_at`을 참조한다. 과거 분석 읽기와 background 저장이 실패한다.
- 실제 Supabase 프로젝트의 migration history는 0건이다. 스키마 변경을 버전 관리 migration으로
  만들고 코드·문서·실제 DB를 하나의 정의로 맞춰야 한다.

### 비용 API — P1 실패

- `src/app/api/macro/route.ts`: 비로그인 요청마다 외부 데이터와 LLM을 호출할 수 있으며 cache,
  rate limit, request coalescing이 없다.
- `src/app/api/stock/[ticker]/consensus/route.ts`: ticker 형식 검증과 rate limit이 없고, 첫 동시
  요청들을 하나의 LLM Promise로 합치지 않는다. 분석 캐시 키가 `currentPrice`를 빠뜨린다.
- 추가 점검: `market-indices`는 in-memory 중복 제거가 있으나 공개 LLM 요청의 공유 rate limit이
  없고, `watchlist-summary`는 한 요청에 최대 50개 외부 뉴스 호출을 한다.
- 실제 20동시 LLM 호출은 비용을 발생시키므로 실행하지 않았다. 수정 후에는 공급자를 mock으로
  대체해 LLM 1회 호출과 429/캐시 응답을 자동 검증한다.

### `src/app/api/valuation/interpret/route.ts` — P2 실패

- 캐시 키에 `name`, `currentPrice.close`, `currentPrice.changeRate`가 없다.
- 전역 캐시 적중 시 처음 생성한 사용자만 히스토리를 저장하고 후속 사용자는 저장하지 않는다.
- 현재가·등락률은 DB 히스토리에 저장되지 않아 나중에 해설 입력을 재현할 수 없다.
- 정책을 선택해야 한다: 공유 결과 캐시를 허용하되 모든 사용자 요청을 스냅샷으로 저장하거나,
  사용자별 캐시로 분리한다.

## 환경·보안 상태

- 로컬에서 public Supabase 변수와 서버 전용 제공자 변수의 존재 여부는 확인했다. 값은 기록하지 않았다.
- GitHub Actions용 `SUPABASE_DB_URL`은 로컬 파일에 없으며, Actions Secret의 실제 존재 여부는 미검증이다.
- Vercel의 `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_API_KEY` 존재 여부도 미검증이다.
  설정이 없으면 Vercel은 기본 `http://localhost:11434`에 연결하려 해 valuation 해설이 500이 된다.
- Supabase Advisor는 `public.handle_new_user()`의 anon/authenticated 실행 가능 상태와 유출
  비밀번호 보호 비활성을 경고한다. trigger용 함수라면 공개 EXECUTE 권한을 제거해야 한다.
- `next.config.ts`에는 기본 헤더가 있으나 CSP와 HSTS는 없다. API 다수는 원본 오류 메시지를
  응답에 반환하므로 운영 환경에서는 일반화된 오류 메시지로 바꾸는 것이 좋다.

## 배포 전 필수 완료 조건

1. P0/P1 항목을 수정하고 migration으로 적용한다.
2. Next.js를 16.3.7 이상, undici를 패치 버전 이상으로 갱신한 뒤 audit을 재실행한다.
3. GitHub Actions Secret과 Vercel 환경변수의 **존재 여부**를 체크리스트로 확인한다.
4. 테스트 사용자 둘로 RLS 교차 읽기·쓰기 거부를 검증한다.
5. 만료 access token/유효 refresh token 인증 E2E를 실행한다.
6. 테스트 DB 또는 mock provider에서 백업 수동 실행과 20동시 비용 API 호출을 검증한다.
7. 깨끗한 PR head에서 lint, type check, build를 실행하고 PR CI로 강제한다.

수정 작업 지시는 [PR-2-REMEDIATION-PROMPT.md](./PR-2-REMEDIATION-PROMPT.md)를 사용한다.
