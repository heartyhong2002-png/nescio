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
- AI 브리핑(원인 분석 + "쩐형" 코멘트)과 재무지표 해설은 로그인한 사용자에 한해
  `stock_analyses` / `valuation_interpretations`에 버전으로 쌓입니다. AI 브리핑 저장은 응답을
  먼저 보낸 뒤 Next.js `after()`에서 처리하고, 재무지표 해설은 새로 생성된 결과만 해당 요청에서
  저장합니다.
- `stock_analyses`는 과거 기록이자 사용자별 영속 캐시입니다. 같은 사용자·종목·말투의 최신
  결과가 10분 이내면 그대로 응답하고, 10분 초과 24시간 이내면 기존 결과를 먼저 응답한 뒤
  백그라운드에서 새 버전을 생성합니다. 24시간을 넘었거나 사용자가 수동 새로고침한 경우에는
  새 분석을 기다립니다.
- 새 브리핑을 만들 때는 같은 종목의 최근 기록 최대 5건을 조회하고 그중 최근 3건의
  `oneLiner`와 원인 제목을 짧은 문맥으로 구성해 1단계 NVIDIA 분석에 전달합니다. 별도의
  OpenRouter/Qwen 이력 요약 호출은 제거되어 API 호출 수와 대기 시간이 줄었습니다.

## 프로젝트 정보

- Supabase 프로젝트 URL: `https://hlyfkgfqwnrxzjkcjiyv.supabase.co` (`.env.local`의
  `NEXT_PUBLIC_SUPABASE_URL`과 동일 — 이 값 자체는 공개돼도 되는 정보입니다)
- 이 문서에는 실제 키 값을 적지 않습니다. 필요한 키는 아래 "환경변수" 표를 보고 `.env.local` /
  `tools/notebooks/.env`에서 확인하세요.

## 환경변수

| 변수 | 어디 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (gitignore, 공개 가능한 값) | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` (gitignore, 공개 가능한 값) | 브라우저에서 쓰는 publishable(구 anon) 키 — RLS로 보호됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | `tools/notebooks/.env` (gitignore, 서버 전용) | RLS 우회하는 관리자 키. **절대 클라이언트 코드에 노출 금지.** 지금은 계정 탈퇴(`auth.admin.deleteUser`) 용도로만 씀 |

`NEXT_PUBLIC_*`는 빌드 시 클라이언트 번들에 그대로 박히기 때문에 `.env.local`에 둡니다.
값 자체는 공개 가능하지만 이 프로젝트에서는 `.env.local`을 커밋하지 않습니다.
`SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 읽어야 해서 다른 서버 전용 키들과 같은 방식
(`serverEnv()` → `tools/notebooks/.env`)으로 관리합니다.

Vercel에 배포할 때는 `NEXT_PUBLIC_*` 두 개와 `SUPABASE_SERVICE_ROLE_KEY`를 Vercel 프로젝트
Settings → Environment Variables에도 동일하게 넣어야 합니다 (다른 API 키들과 같은 이유 —
`tools/notebooks/.env` 파일은 배포본에 안 올라갑니다). 종목 브리핑용 `NVIDIA_API_KEY`,
`GROQ_API_KEY`, `GEMINI_API_KEY`도 Vercel 환경변수에 별도로 등록하고 재배포해야 합니다.
로컬 파일의 키를 바꾸는 것만으로는 배포 환경이 갱신되지 않습니다.

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
- **`stock_analyses`** (신규): 새로 생성된 AI 브리핑(원인 분석 + 코멘트)의 히스토리이자
  사용자별 영속 캐시. `watchlist_items`와 달리 "현재 값 하나"가 아니라 생성된 스냅샷을
  계속 쌓는 구조라 unique 제약이 없고, `(user_id, ticker, created_at desc)` 인덱스로 최신순
  조회를 지원합니다. `price`/`news`/`briefing` 컬럼은 각각 `Price`/`NewsItem[]`/`Briefing`
  타입을 그대로 jsonb로 저장합니다.
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
| `src/app/api/analyze/route.ts` | AI 브리핑 생성, 영속 캐시 조회, 백그라운드 갱신·저장 |
| `src/lib/use-briefing.ts` | 브라우저 세션 캐시 표시, 비 JSON 오류 처리, 백그라운드 갱신 확인 |
| `src/app/api/valuation/interpret/route.ts` | 지표 해설 생성 + 로그인 시 `valuation_interpretations`에 저장 |
| `docs/supabase-schema.sql` | 실제 마이그레이션 SQL (Studio SQL Editor에 그대로 실행) |

## 알려진 한계 / 다음에 볼 것

- `stock_analyses`는 현재 브리핑 캐시와 이력 문맥에 사용하지만, 저장된 과거 버전을 사용자가
  직접 조회하는 히스토리 UI는 아직 없습니다 — 다음 세션에서 필요하면
  추가하세요(예: 종목 페이지에 "과거 분석 보기" 탭, `select ... where user_id = ? and
  ticker = ? order by created_at desc`).
- `stock_analyses`에는 말투(`tone`) 컬럼이 없습니다. 따라서 기본 말투만 영속 저장하며 다른
  말투는 서버 메모리·브라우저 세션 범위에서만 캐시합니다. 사용자·종목·말투를 포함한 캐시 키로
  다른 사용자나 다른 말투의 결과가 섞이지 않게 합니다.
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
