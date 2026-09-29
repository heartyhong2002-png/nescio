# PR #2 수정 작업용 프롬프트

아래 블록을 다른 AI에게 그대로 전달한다. 비밀값을 프롬프트·로그·커밋에 넣지 않는다.

```text
Nescio PR #2의 배포 차단 항목을 수정해줘. 구현 범위는 아래 P0/P1을 우선으로 하고, 기존 사용자 변경은 보존해. 작업 전 `git status`와 PR의 실제 base/head를 확인해. 현재 GitHub PR #2의 실제 방향은 main → fix-valuation-retry로 확인됐으므로, 머지 방향이 의도와 맞는지 먼저 보고하고 임의로 PR을 변경하지 마.

중요 원칙
- 비밀값을 읽거나 출력하거나 커밋하지 마. 환경변수는 존재 여부만 검증해.
- 실제 운영 DB를 변경하기 전에는 migration과 영향 범위를 제시해. 테스트 데이터는 격리 환경에서만 만들어.
- 기존 UI·데이터 API 계약을 불필요하게 바꾸지 마.
- Next.js 16 프로젝트이므로 코드 변경 전 로컬 next 문서를 읽어.
- Supabase 작업 전 최신 Supabase SSR/RLS 문서를 확인해.
- 수정마다 lint, type check, build 및 관련 자동 테스트를 실행해. 실패는 숨기지 마.

P0 — DB backup workflow
대상: .github/workflows/db-backup.yml
1. db-backups 브랜치를 checkout한 뒤 public schema를 날짜별 SQL 파일로 dump한다.
2. backups/*.sql 중 30일 초과 파일을 실제 삭제한다.
3. 변경된 backup 파일을 git add/commit/push하여 db-backups 브랜치에 남긴다.
4. contents: write 권한과 schedule/workflow_dispatch 경합을 막는 concurrency를 추가한다.
5. 실패한 dump/prune/commit/push가 성공으로 보이지 않게 set -euo pipefail을 유지한다.
6. "당일" 기준은 Asia/Seoul 또는 UTC 중 하나로 문서와 파일명에 일관되게 명시한다.
7. Git 이력에는 삭제 파일이 남는다는 보존 한계를 README/운영 문서에 기록하고, 민감 데이터 보관 정책을 제안한다.
8. 실제 운영 Secret을 노출하지 말고, 테스트 DB 또는 mock pg_dump로 수동 실행 성공·실패를 검증한다.

P1 — Supabase 인증 세션
대상: src/proxy.ts, src/lib/supabase/middleware.ts
1. updateSession이 갱신한 모든 Set-Cookie와 Supabase가 전달하는 cache-control 관련 헤더를 redirect 응답에도 보존한다.
2. Supabase 현재 권장 방식에 맞춰 Proxy의 안전한 claims/session 검증 방식을 점검한다.
3. 만료 access token + 유효 refresh token 상태에서 다음 E2E를 작성·실행한다.
   - /onboarding/login 진입 후 홈 redirect에 갱신 쿠키가 포함됨
   - redirect 뒤 /my 접근이 로그인 화면으로 되돌아가지 않음
   - 보호 경로 비로그인 접근은 로그인 redirect
4. 테스트는 실제 개인 계정이 아닌 제어 가능한 test user 또는 mock auth provider를 사용한다.

P1 — Supabase 스키마/RLS
대상: docs/supabase-schema.sql, src/app/api/analyze/route.ts, Supabase migration
1. 실제 stock_analyses 스키마와 코드 불일치를 해결한다. 현재 실제 DB는 name/tone/generated_at을 가지지만 API와 문서는 stock_name/created_at을 참조한다.
2. 원하는 스키마를 하나로 결정하고, 그 결정에 맞춘 versioned migration을 만든다. docs/supabase-schema.sql, API select/insert/order, 타입을 함께 맞춘다.
3. profiles, watchlist_items, stock_analyses, valuation_interpretations에 대해 두 테스트 사용자로 본인 행 읽기·쓰기만 허용되고 다른 사용자 행은 select/insert/update/delete 모두 거부되는지 테스트한다.
4. public.handle_new_user()가 trigger 외 RPC로 호출되지 않도록 공개 EXECUTE 권한을 제거한다. SECURITY DEFINER를 단순히 INVOKER로 바꿔 trigger를 깨지지 않게 주의한다.
5. RLS policy의 auth.uid()는 성능 권고에 맞춰 (select auth.uid()) 형태를 검토하고, UPDATE 정책에는 USING과 WITH CHECK를 명시한다.

P1 — 비용 발생 API
대상: src/app/api/macro/route.ts, src/app/api/stock/[ticker]/consensus/route.ts, 관련 analyzer
1. ticker를 대문자 6자리 영숫자로 검증한다. 한국 거래소의 영숫자 종목 코드도 허용해야 한다.
2. route 수준 rate limit을 적용하고 한도 초과 시 Retry-After와 429를 반환한다. 서버리스 멀티 인스턴스에서는 공유 저장소 기반 limiter가 필요하다는 점을 반영한다.
3. 외부 데이터/LLM 호출에 TTL cache와 in-flight Promise deduplication을 구현한다. 실패 Promise는 cache에서 제거한다.
4. consensus 분석 cache key에는 ticker, 보고서 식별자, currentPrice, 모델/프롬프트 버전을 포함한다.
5. 20개 동시 요청 테스트에서 provider mock 호출이 한 번만 발생함을 증명하고, 한도 초과는 429 또는 캐시 응답인지 검증한다. 실제 유료 LLM을 20회 호출하지 마.
6. market-indices, watchlist-summary, IPO AI routes도 같은 관점에서 요청량·입력 크기·중복 호출을 검토하고 최소 안전장치를 적용한다.

P2 — valuation 해설
대상: src/app/api/valuation/interpret/route.ts, 관련 schema/documentation
1. 캐시 키에 ticker, 정규화한 name, PER/PBR/dividend/marketCap, currentPrice.close, currentPrice.changeRate, 모델/프롬프트 버전을 포함한다.
2. 사용자별 히스토리 정책을 명확히 선택한다. 공유 캐시를 쓰더라도 요청한 모든 사용자에게 입력 스냅샷과 해설을 저장할지, 캐시를 사용자별로 분리할지 결정하고 문서화한다.
3. 히스토리에 현재가·등락률 또는 완전한 input JSON snapshot을 저장한다.
4. 두 사용자와 서로 다른 현재가의 요청에서 결과/저장이 섞이지 않는 테스트를 추가한다.

공급망·배포 문서
1. Next.js를 16.3.7 이상으로, undici를 audit의 patched compatible version으로 업데이트하고 package-lock을 갱신한다. npm audit --omit=dev를 다시 실행한다.
2. README와 docs/SUPABASE.md에 SUPABASE_DB_URL(GitHub Actions Secret 전용), OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_API_KEY의 용도와 배포 위치를 문서화한다. 값은 절대 쓰지 않는다.
3. Vercel/GitHub Secrets는 존재 여부 체크리스트로만 검증한다.
4. lint/build만이 아니라 PR CI에서 lint, type check, build, mock 기반 핵심 E2E를 실행하도록 workflow를 추가한다.
5. API 응답에서 외부 공급자 원본 오류를 노출하지 않도록 일반화하고, 서버 로그에는 안전한 원인만 남긴다.

완료 보고 형식
- 수정 파일과 변경 이유
- 실행한 테스트와 결과
- 각 P0/P1/P2의 통과/실패/미검증 및 미검증 사유
- 필요한 환경변수/Secrets의 이름과 존재 여부만
- 남은 리스크와 배포 가능 여부
- P0/P1 하나라도 미해결이면 배포하지 말고 재현 절차를 적어줘.
```
