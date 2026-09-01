# Nescio

주식 초보자를 위한 "왜 올랐지? 왜 내렸지?" 설명 앱. 관심종목을 등록하면 오늘의 시세 변동을
뉴스와 엮어서, 애널리스트 리포트가 아니라 친구가 설명해주는 것 같은 말투로 풀어줍니다.

## 무엇을 하는 앱인가

1. 관심종목을 검색해서 등록 (KRX 종목 목록 기준)
2. 홈 화면에서 관심종목의 오늘 등락률과 한 줄 요약을 카드로 확인
3. 종목을 누르면 "왜 이렇게 움직였는지"를 원인별로 분해해서 보여줌 — 인과관계 타임라인,
   근거가 된 뉴스, 긍정/부정 요인, 과거 비슷한 사례까지
4. 설명은 두 단계 LLM 호출로 생성됨: 1단계(NVIDIA)가 시세+뉴스를 사실 위주로 분석하고,
   2단계(xAI Grok)가 그 분석을 캐주얼한 캐릭터 말투로 다시 씀(말투 강도는 4단계로 조절 가능,
   `src/app/api/analyze/route.ts`의 `TONE_RULES` 참고). 투자 매수·매도 권유는 하지 않고
   항상 면책 문구가 붙습니다.

## 폴더 구조

```
src/                     실제 서비스되는 Next.js 앱 (여기가 진짜)
  app/                   화면(온보딩/관심종목/종목상세/알림/마이페이지)과 API 라우트
  lib/                   KRX 시세, 저장소(localStorage), 포맷 등 공통 로직
public/                  정적 파일
notebooks/.env           로컬 개발용 서버 API 키 (커밋되지 않음, 아래 환경변수 참고)
.env.local               NEXT_PUBLIC_* 값 (Supabase 등, 커밋되지 않음, 아래 환경변수 참고)
data-pipeline/           초기 데이터 파이프라인 실험 (Python, pykrx+네이버+LLM 분석 노트북/스크립트)
                         — 지금 서비스가 쓰는 코드는 아니고, 프롬프트/파이프라인 설계 실험용
legacy-ui-mockup/        8/23에 만든 정적 HTML UI 목업 (지금 화면의 이전 버전, 참고용)
docs/                    지난 세션들의 기술 메모 (HANDOFF.md 등)
```

## 시작하기

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속.

## 환경변수

두 군데로 나뉜다 — 섞어서 넣으면 (특히 `NEXT_PUBLIC_*`는) 조용히 안 먹으니 주의:

- **`notebooks/.env`**: 서버 전용 API 키. `src/lib/server-env.ts`의 `serverEnv()`가 런타임에 이
  파일을 읽어서 폴백으로 쓴다 — 파일이 없어도 앱은 죽지 않고 해당 기능만 비활성화된다.
- **`.env.local`(프로젝트 루트, 신규 생성 필요)**: `NEXT_PUBLIC_*`로 시작하는 값 전용. Next.js가
  빌드 시 클라이언트 번들에 정적으로 인라인해야 하는 값이라 `serverEnv()` 폴백(런타임에 파일을
  읽는 방식)이 통하지 않는다 — 반드시 Next.js가 직접 로드하는 `.env.local`에 있어야 한다.

둘 다 `.gitignore`의 `.env*` 규칙에 걸려서 커밋되지 않는다. Vercel에 배포할 때는 두 파일 대신
프로젝트 Settings → Environment Variables에 아래 값을 전부 똑같이 넣어주면 됩니다.

`notebooks/.env`:

| 변수 | 용도 | 필수 |
|---|---|---|
| `NVIDIA_API_KEY` | 1단계 사실 분석 (NVIDIA) | 필수 |
| `XAI_API_KEY` | 2단계 캐릭터 톤 재작성 (xAI Grok) | 필수 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 관련 뉴스 검색 (네이버 뉴스 API) | 필수 |
| `KRX_AUTH_KEY` | 종목 목록·일별 시세 (KRX Open API) | 필수 |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 분봉·기간별 차트, PER/PBR/배당/시가총액 (한국투자증권 Open API) | 필수 |
| `EXIM_AUTH_KEY` | 환율 화면 · 브리핑 참고용 환율 (한국수출입은행 Open API, [신청](https://www.koreaexim.go.kr) 무료) | 필수 (환율 기능용) |
| `NVIDIA_MODEL` / `XAI_MODEL` | 각 단계에서 쓸 모델명 오버라이드 | 선택 (기본값 있음) |
| `KIS_BASE_URL` | KIS API 베이스 URL 오버라이드 (기본: 실전 `openapi.koreainvestment.com:9443`) | 선택 |

`.env.local`:

| 변수 | 용도 | 필수 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (계정/관심종목 DB) — Settings → API의 "Project URL" (`https://xxxxx.supabase.co`, `/rest/v1/` 같은 경로 없이) | 필수 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 퍼블리셔블(anon) 키 | 필수 |

## 계정 · 관심종목 DB (Supabase)

로그인/회원가입과 관심종목 저장은 [Supabase](https://supabase.com)(무료 티어)를 쓴다. 처음 설정할 때:

1. supabase.com에서 새 프로젝트 생성
2. Settings → API에서 **Project URL**과 **publishable(anon) key** 확인 → 위 환경변수 두 개에 반영
3. SQL Editor에서 `docs/supabase-schema.sql`(이 저장소에 포함)을 그대로 실행 — `profiles`/`watchlist_items` 테이블과 RLS 정책, 신규가입 시 프로필 자동 생성 트리거가 만들어진다
4. Authentication → Providers → Email에서 "Confirm email"을 꺼두는 걸 추천 — 켜두면 회원가입 직후 바로 온보딩으로 넘어가는 지금 흐름이 이메일 인증 전까지 막힌다(대신 이메일 진위 확인은 포기하는 트레이드오프)

## 배포

Vercel에 GitHub 저장소를 연결하면 바로 배포됩니다 (Next.js 앱이라 별도 설정 거의 불필요).
배포 후 위 환경변수를 Vercel 프로젝트 Settings에 추가하고 Redeploy 해야 반영됩니다.
