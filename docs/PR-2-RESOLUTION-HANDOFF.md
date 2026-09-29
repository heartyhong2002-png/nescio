# Nescio PR #2 품질·배포 게이트 조치 완료 및 AI 인수인계 문서 (Handoff Prompt)

> 이 문서는 다른 AI 코딩 어시스턴트(Claude, GPT, Gemini 등)에게 Nescio 프로젝트의 최신 상태를 즉시 전달하고 작업을 이어갈 수 있도록 작성된 독립 인수인계 프롬프트입니다.

---

```text
[Nescio 프로젝트 컨텍스트 및 최신 인수인계 지침]

1. 프로젝트 개요 및 최신 상태 (2026-09-29 기준)
- 기술 스택: Next.js 16.3.7 (App Router, Turbopack) + React 19.2.8 + TypeScript 5 + Tailwind CSS v4 + Supabase (Auth & Postgres).
- 브랜치 현황: 'main' 브랜치가 단일 진실 공급원(Single Source of Truth)이며, 모든 품질·보안 게이트가 통과되어 즉시 배포 가능한 상태(READY FOR DEPLOYMENT)입니다. 과거 역방향으로 열렸던 GitHub PR #2('fix-valuation')는 Closed 처리되었습니다.
- CI/CD 파이프라인: '.github/workflows/ci.yml'이 신설되어 모든 PR/push 시 lint, type check, automated tests (npm test), build를 강제합니다. (GitHub Actions 성공 확인 완료)

2. 주요 아키텍처 규칙 및 주의점
- Next.js 16 규칙: 'middleware.ts'는 'src/proxy.ts'로 대체되었습니다. 인증 세션 갱신 및 라우트 보호는 'src/proxy.ts'에서 처리하며, 리다이렉트 시 'copySessionHeaders()'를 통해 Set-Cookie 및 Cache-Control 헤더를 반드시 보존해야 세션 풀림 루프가 발생하지 않습니다.
- 시크릿 및 환경 변수 보관:
  - 클라이언트 공개 키: '.env.local' ('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  - 서버 전용 비밀 키: 'tools/notebooks/.env' ('serverEnv()' 함수로 안전하게 접근, 절대 클라이언트 번들이나 Git 커밋에 노출 금지)
  - GitHub Actions Secret: 'SUPABASE_DB_URL' (Session pooler 5432 포트 URI, DB 자동 백업 워크플로 전용)
  - Vercel 배포 환경 변수: 'OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'OLLAMA_API_KEY' (재무지표 해설 기능용)
- 비밀값 원칙: 비밀값을 절대 읽거나 터미널에 출력하거나 커밋하지 마십시오.

3. 데이터베이스 및 RLS 현황 (Supabase)
- 테이블 구성:
  1) 'profiles': 사용자 온보딩/성향 정보 ('auth.users' 1:1 cascade)
  2) 'watchlist_items': 사용자별 관심종목 ('user_id', 'ticker' unique)
  3) 'stock_analyses': AI 브리핑 스냅샷 및 영속 캐시 ('user_id', 'ticker', 'stock_name', 'price', 'news', 'briefing', 'generated_at', 'created_at')
  4) 'valuation_interpretations': 재무지표 해설 스냅샷 ('user_id', 'ticker', 'stock_name', 'metrics', 'interpretation', 'created_at')
- 스키마 정규화 완료: 'docs/migrations/v001_schema_normalization.sql'이 운영 DB에 성공적으로 반영되어 'stock_analyses' 컬럼이 'stock_name' 및 'created_at'으로 완전히 동기화되었습니다.
- RLS 보안: 모든 테이블의 RLS 정책은 최적화된 '(select auth.uid())' 패턴을 따르며, UPDATE 정책에는 'WITH CHECK'가 명시되어 있습니다. 'public.handle_new_user()' 함수의 공개 EXECUTE 권한은 제거되었습니다.

4. 비용 발생 API 안전장치
- '/api/analyze', '/api/valuation/interpret', '/api/ipos/analyze', '/api/ipos/monthly-analysis', '/api/watchlist-summary': 'requireAuth()'를 통한 인증 강제.
- '/api/macro', '/api/stock/[ticker]/consensus':
  - IP 기반 rate limit (10 req/min, 429 Retry-After).
  - Ticker 1~10자리 영숫자 유효성 검증.
  - TTL 인메모리 캐시 및 in-flight Promise deduplication (동시 20개 요청 시 외부 공급자 호출 단 1회로 병합).
  - 외부 공급자 원본 에러 마스킹 (클라이언트에는 일반화된 에러 반환, 상세 원인은 서버 로그에만 기록).
- '/api/market-indices' (30 req/min), '/api/watchlist-summary' (15 req/min)에도 최소 레이트 리미트 적용.

5. 테스트 및 검증 도구
- 단위/E2E 테스트 실행: 'npm test' (Node 24 네이티브 'node --test tests/*.test.mjs' 실행, 15개 항목 전체 통과)
- 정적 검사: 'npm run lint' (0 error, 0 warning)
- 타입 검사: 'npx tsc --noEmit' (0 error)
- 프로덕션 빌드: 'npm run build' (성공)
- 종속성 보안 감사: 'npm audit --omit=dev' (0 vulnerabilities, Next 16.3.7, undici 8.11.2 적용)

6. 작업 시 유의사항
- 기존 UI 계약 및 API 계약을 불필요하게 변경하지 마십시오.
- 코드를 변경한 뒤에는 항상 'npm test', 'npm run lint', 'npx tsc --noEmit', 'npm run build'를 차례로 실행하여 무결성을 검증하십시오.
```
