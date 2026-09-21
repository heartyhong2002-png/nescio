# Supabase 연동 (인증 + DB)

> 이 문서는 다른 세션(다른 Claude 세션, 또는 나중의 나 자신)이 Supabase Studio에서 이미
> 만들어진 백엔드를 코드만 보고도 파악할 수 있게 정리한 것입니다. **실제 Supabase 프로젝트에
> 직접 접속하는 도구(MCP)가 없는 세션에서 코드를 읽고 역추적한 내용**이라, 아래 스키마는
> "코드가 기대하는 모양"이지 Supabase Studio에 100% 그대로 있다는 보장은 아닙니다. 세션을 새로
> 시작했는데 이 문서와 실제 동작이 다르면, Studio의 Table Editor / SQL Editor에서 실제 스키마를
> 다시 확인해서 이 문서를 갱신해주세요.

## 무엇을 위한 건가

원래 nescio는 로그인 없이 브라우저 `localStorage`에 관심종목/온보딩 정보를 저장하는 앱이었습니다.
이후 세션에서 이메일/비밀번호 로그인(Supabase Auth) + 사용자별 DB 저장(Supabase Postgres)으로
전환하는 작업을 진행했습니다. 그래서 지금은:

- 로그인 없이도 앱은 켜지지만(placeholder 클라이언트로 대체), 관심종목 저장·프로필 저장은
  로그인해야 동작합니다.
- 로그인 전 브라우저에 남아있던 `localStorage` 데이터(관심종목/온보딩)는 로그인 직후 한 번만
  DB로 자동 이전됩니다(`src/lib/migrate-legacy-storage.ts`).
- 종목 상세 페이지를 열 때마다 서버가 새로 생성하는 AI 브리핑(원인 분석 + "쩐형" 코멘트)과
  재무지표 해설도, 로그인한 사용자에 한해 `stock_analyses` / `valuation_interpretations`에
  버전으로 계속 쌓입니다(`/api/analyze`, `/api/valuation/interpret` 라우트가 응답 직전에
  서버 사이드에서 저장 — 비로그인 요청은 지금까지처럼 저장 없이 그냥 응답만 나갑니다).
- `stock_analyses`에 쌓인 이력은 그냥 저장만 되는 게 아니라 다음 분석에 다시 쓰입니다.
  `/api/analyze`가 브리핑을 새로 만들기 전에, 로그인한 사용자가 같은 종목을 조회했던 과거
  기록(최근 5건)을 DB에서 불러와 OpenRouter(오픈소스 모델, 기본 Qwen)로 짧게 요약하고, 그
  요약을 1단계(NVIDIA) 분석 프롬프트에 참고 컨텍스트로 얹습니다 — "반복되는 원인이 뭔지",
  "최근 흐름이 어떻게 바뀌어왔는지"를 새 분석이 이어받게 하려는 목적입니다. 이 이력 요약
  단계는 `src/app/api/analyze/route.ts`의 `fetchAnalysisHistory` / `summarizeHistory` /
  `callOpenRouter` 함수를 보면 됩니다. 실패하거나(과거 기록 없음, API 오류 등) 비로그인
  요청이면 그냥 빈 컨텍스트로 조용히 넘어가고 본 브리핑 파이프라인은 그대로 동작합니다.

## 프로젝트 정보

- Supabase 프로젝트 URL: `https://hlyfkgfqwnrxzjkcjiyv.supabase.co` (`.env.local`의
  `NEXT_PUBLIC_SUPABASE_URL`과 동일 — 이 값 자체는 공개돼도 되는 정보입니다)
- 이 문서에는 실제 키 값을 적지 않습니다. 필요한 키는 아래 "환경변수" 표를 보고 `.env.local` /
  `notebooks/.env`에서 확인하세요.

## 환경변수

| 변수 | 어디 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (커밋됨, 공개 가능) | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` (커밋됨, 공개 가능) | 브라우저에서 쓰는 publishable(구 anon) 키 — RLS로 보호됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | `notebooks/.env` (gitignore, 서버 전용) | RLS 우회하는 관리자 키. **절대 클라이언트 코드에 노출 금지.** 지금은 계정 탈퇴(`auth.admin.deleteUser`) 용도로만 씀 |
| `OPENROUTER_API_KEY` | `notebooks/.env` (gitignore, 서버 전용) | 과거 분석 이력 요약 전용 LLM 호출 키(발급: https://openrouter.ai/keys). **미설정 시 에러가 아니라 이력 요약을 그냥 건너뜀** — `/api/analyze` 본 파이프라인은 정상 동작 |
| `OPENROUTER_MODEL` | `notebooks/.env` (선택) | 이력 요약에 쓸 OpenRouter 모델 슬러그. 기본값 `qwen/qwen-2.5-72b-instruct` — 다른 오픈소스 모델(Llama, DeepSeek 등)로 바꾸고 싶으면 이 값만 변경 |

`NEXT_PUBLIC_*`는 빌드 시 클라이언트 번들에 그대로 박히기 때문에 `.env.local`에 두고 커밋
(공개돼도 되는 값들). `SUPABASE_SERVICE_ROLE_KEY`/`OPENROUTER_API_KEY`는 서버에서만 읽어야
해서 다른 서버 전용 키들과 같은 방식(`serverEnv()` → `notebooks/.env`)으로 관리합니다.

Vercel에 배포할 때는 `NEXT_PUBLIC_*` 두 개와 `SUPABASE_SERVICE_ROLE_KEY`를 Vercel 프로젝트
Settings → Environment Variables에도 동일하게 넣어야 합니다 (다른 API 키들과 같은 이유 —
`notebooks/.env` 파일은 배포본에 안 올라갑니다). `OPENROUTER_API_KEY`도 마찬가지로 배포
환경에 등록해야 이력 요약이 실제로 동작합니다(안 넣으면 에러 없이 그냥 스킵됨).

## 인증(Auth)

- 이메일 + 비밀번호 방식 (`src/lib/auth-context.tsx`) — `signInWithPassword` / `signUp` /
  `signOut`.
- Supabase 프로젝트의 "Confirm email" 설정이 켜져 있으면, 가입 직후 세션이 바로 안 생기고
  이메일 인증 링크를 눌러야 로그인됩니다 (`signUp` 리턴값의 `needsEmailConfirm`로 구분).
- 세션 갱신은 `src/proxy.ts` → `src/lib/supabase/middleware.ts`가 매 요청마다 `getUser()`로
  처리합니다 (`getSession()`이 아님 — 서버에서는 위조된 쿠키를 걸러내기 위해 반드시 서버
  왕복 검증이 필요하다는 Supabase 공식 권고를 따름).
- **서버 사이드 라우트/API 보호 (`src/lib/require-auth.ts`)**:
  - `requireAuth()`: API 라우트 및 서버 액션에서 유효한 로그인 세션을 강제 검증하며, 미인증 요청 시 401 반환.
  - `requireAdmin()`: 관리자 권한(`service_role`) 및 사용자 세션 검증.
- **비밀번호 찾기 및 재설정 (`src/app/onboarding/reset-password`, `update-password`)**:
  - `resetPasswordForEmail`을 통한 재설정 메일 발송 및 토큰 기반 신규 비밀번호 변경 흐름 완비.
- **TOTP 기반 2단계 인증(MFA) (`src/app/my/security`, `src/app/onboarding/verify-mfa`)**:
  - Supabase Auth MFA (`auth.mfa.enroll`, `challenge`, `verify`, `unenroll`) 완벽 연동.
  - 마이페이지 보안 탭(`/my/security`)에서 QR 코드 스캔을 통한 Google Authenticator 등 등록 지원.
  - MFA가 활성화된 계정은 로그인 직후 `/onboarding/verify-mfa`로 전환되어 6자리 OTP 인증 후 최종 세션 부여.

## 데이터베이스 스키마

실제 마이그레이션 SQL은 `docs/supabase-schema.sql`에 있습니다 — Studio SQL Editor에 그대로
붙여넣어 실행하면 됩니다. 여기서는 각 테이블이 왜 이런 모양인지만 요약합니다.

- **`profiles`**: `auth.users` 1:1. `persona`/`sectors`/`onboarded`로 온보딩 상태를 저장.
  회원가입 시 트리거(`handle_new_user`)가 자동으로 빈 행을 만들어줘서 앱 코드가 "가입 후
  프로필 생성"을 따로 호출하지 않습니다.
- **`watchlist_items`**: 사용자별 관심종목. `unique (user_id, ticker)`라서
  `watchlist-context.tsx`의 upsert가 `onConflict: "user_id,ticker"`로 동작합니다.
- **`stock_analyses`** (신규): 종목 상세 페이지를 열 때마다 생성되는 AI 브리핑(원인 분석 +
  코멘트)의 히스토리. `watchlist_items`와 달리 "현재 값 하나"가 아니라 매번 새로 생성된
  스냅샷을 계속 쌓는 구조라 unique 제약이 없고, `(user_id, ticker, created_at desc)`
  인덱스로 최신순 조회를 지원합니다. `price`/`news`/`briefing` 컬럼은 각각 `Price`/
  `NewsItem[]`/`Briefing` 타입을 그대로 jsonb로 저장합니다.
- **`valuation_interpretations`** (신규): PER/PBR/배당/시총 해설의 히스토리. 구조는
  `stock_analyses`와 동일한 원칙(버전 쌓기, unique 없음).

두 신규 테이블 모두 클라이언트가 직접 insert하지 않고, `/api/analyze` /
`/api/valuation/interpret` 라우트가 서버 사이드에서 로그인 세션을 확인한 뒤 저장합니다 —
그래서 insert 정책도 select 정책과 마찬가지로 "본인 것만"으로 걸려 있습니다(update/delete
정책은 없음 — 히스토리라 수정하지 않음).

```sql
-- RLS: 네 테이블 모두 반드시 켜져 있어야 함 (안 그러면 다른 사용자 데이터가 다 보임/써짐)
alter table public.profiles enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.stock_analyses enable row level security;
alter table public.valuation_interpretations enable row level security;
```

계정 탈퇴 시 네 테이블을 따로 지우지 않고 `auth.admin.deleteUser`만 호출하는 이유가
`on delete cascade`입니다 — 이게 실제로 안 걸려 있으면 탈퇴해도 고아 행이 남습니다.

## 코드에서 어디를 보면 되는지

| 파일 | 역할 |
|---|---|
| `src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 (싱글턴) |
| `src/lib/supabase/server.ts` | 서버 컴포넌트/라우트용 클라이언트 (요청마다 새로 생성) |
| `src/lib/supabase/middleware.ts` + `src/proxy.ts` | 매 요청마다 세션 쿠키 갱신 |
| `src/lib/supabase/admin.ts` | 서비스 롤 키로 만든 관리자 클라이언트 (계정 탈퇴 전용) |
| `src/lib/auth-context.tsx` | 로그인 상태 전역 관리 (`AuthProvider`) |
| `src/lib/profile-context.tsx` | `profiles` 테이블 읽기/쓰기 (`ProfileProvider`) |
| `src/lib/watchlist-context.tsx` | `watchlist_items` 테이블 읽기/쓰기 (`WatchlistProvider`) |
| `src/lib/migrate-legacy-storage.ts` | 로그인 직후 구버전 localStorage 데이터를 1회 DB로 이전 |
| `src/app/api/account/delete/route.ts` | 계정 탈퇴 API (서비스 롤 키 필요) |
| `src/app/onboarding/login/page.tsx` | 로그인/회원가입 화면 |
| `src/app/api/analyze/route.ts` | AI 브리핑 생성 + 로그인 시 `stock_analyses`에 저장 |
| `src/app/api/valuation/interpret/route.ts` | 지표 해설 생성 + 로그인 시 `valuation_interpretations`에 저장 |
| `docs/supabase-schema.sql` | 실제 마이그레이션 SQL (Studio SQL Editor에 그대로 실행) |

## 알려진 한계 / 다음에 볼 것

- 서버 사이드 라우트 보호 미구현 (위 참고)
- `stock_analyses` / `valuation_interpretations`는 저장 로직만 구현된 상태입니다. 저장된
  과거 버전을 사용자가 화면에서 조회하는 히스토리 UI는 아직 없습니다 — 다음 세션에서 필요하면
  추가하세요(예: 종목 페이지에 "과거 분석 보기" 탭, `select ... where user_id = ? and
  ticker = ? order by created_at desc`).
- 두 테이블 모두 버전을 무한히 쌓기만 하고 정리(retention)하지 않습니다. 사용자가 같은
  종목을 자주 들여다보면 행이 계속 늘어나므로, 필요해지면 오래된 행을 주기적으로 지우는
  것도 고려하세요.
- `docs/supabase-schema.sql`이 실제 마이그레이션 소스입니다. Studio에 이미 적용된 스키마와
  이 파일이 어긋나는지 의심되면 아래 쿼리로 실제 컬럼을 확인해서 두 문서를 맞춰주세요:
  ```sql
  select table_name, column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position;
  ```
