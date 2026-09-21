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
5. 공모주(IPO) 올인원 대시보드:
   - **공모 청약 & AI 진단**: DART 전자공시 및 38커뮤니케이션 데이터를 교차 검증하여 기관 수요예측 경쟁률, 의무보유확약 비율, 복수 주관사별 배정수량 및 청약한도, 최소 청약 단위(증거금), 기업 개요 및 재무 현황을 제공하며, LLM 기반 청약 AI 진단 리포트(추천/신중/패스 판정, 핵심 호재/주의점, 맞춤 청약 전략)를 제공합니다.
   - **상장 예정 현황 & 2026 첫날 실전 성적표**: 상장 대기 종목 일정, 2026년 상장 종목들의 공모가 대비 시초가·종가 수익률 및 따따블(+300%)/따블/손실 통계 대시보드를 제공합니다.
   - **🤖 AI 월별 시장 트렌드 & 정책/이슈 리포트**: 월별(전체/9월~3월) 공모주 시장 분위기, 주가 등락을 가른 핵심 요인, 당시 정부·금융당국 정책(가격제한폭 400%, 기술특례 실사 강화 등) 및 거시 이슈를 AI가 종합 진단하여 실전 투자 교훈을 도출합니다.
6. 글로벌 매크로(원자재·금리·환율) 대시보드 & 다중 LLM 거시경제 브리핑:
   - **11대 글로벌 핵심 지표 실시간 시세**: 유가(WTI), 금, 구리, 농산물(옥수수, 밀), 미 국채 10년물 금리, 달러 인덱스, VIX 공포 지수, 필라델피아 반도체 지수, 나스닥 100, 비트코인 시세 제공 (Yahoo Finance 연동).
   - **다중 LLM 증시 영향 브리핑**: 주요 통화 환율과 거시 지표 변동이 왜 주식 시장에 영향을 미치는지 자연어로 요약 브리핑 제공 (NVIDIA / Groq / Cerebras / Gemini + 룰베이스 무중단 폴백).
7. 전문 인터랙티브 차트 & 계정 보안(MFA):
   - **고급 차트 분석**: 캔들스틱/라인 모드 전환, 5/20/60/120일 이동평균선(MA), 볼린저 밴드, 거래량 오버레이 및 십자선 커서/툴팁 지원.
   - **계정 보안 관리**: 비밀번호 재설정/변경 및 TOTP 기반 2단계 인증(MFA, Google Authenticator 등), 활성 세션 관리.

## 폴더 구조

```
src/                     실제 서비스되는 Next.js 앱 (여기가 진짜)
  app/                   화면(홈/관심종목/종목상세/공모주/매크로/알림/마이페이지)과 API 라우트
  lib/                   KRX/KIS 시세, 매크로 지표, 저장소, 인증, 포맷 등 공통 로직
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
| `NVIDIA_API_KEY` | 1단계 사실 분석 및 매크로 브리핑 (NVIDIA) | 필수 |
| `XAI_API_KEY` | 2단계 캐릭터 톤 재작성 (xAI Grok) | 필수 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 관련 뉴스 검색 (네이버 뉴스 API) | 필수 |
| `KRX_AUTH_KEY` | 종목 목록·일별 시세 (KRX Open API) | 필수 |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 분봉·기간별 차트, PER/PBR/배당/시가총액 (한국투자증권 Open API) | 필수 |
| `EXIM_AUTH_KEY` | 매크로/환율 화면 · 브리핑 참고용 환율 (한국수출입은행 Open API, [신청](https://www.koreaexim.go.kr) 무료) | 필수 (환율 기능용) |
| `DART_API_KEY` | 공모주 화면 — 청약일정·공모가·주관사 (금융감독원 OpenDART, [신청](https://opendart.fss.or.kr) 무료, 이메일 인증만 필요) | 필수 (공모주 기능용) |
| `GROQ_API_KEY` | 공모주 AI 분석, 매크로 브리핑 및 2단계 톤 고속 생성 (Groq LPU) | 선택 (빠른 응답) |
| `GEMINI_API_KEY` | 공모주 AI 분석, 매크로 브리핑 및 텍스트 폴백 (Google Gemini) | 선택 |
| `CEREBRAS_API_KEY` | 매크로 브리핑 초고속 추론 (Cerebras) | 선택 |
| `NVIDIA_MODEL` / `XAI_MODEL` / `GROQ_MODEL` / `GEMINI_MODEL` / `CEREBRAS_MODEL` | 각 단계 및 LLM 엔진에서 쓸 모델명 오버라이드 | 선택 (기본값 있음) |
| `KIS_BASE_URL` | KIS API 베이스 URL 오버라이드 (기본: 실전 `openapi.koreainvestment.com:9443`) | 선택 |
| `SUPABASE_SERVICE_ROLE_KEY` | 계정 탈퇴(관리자 권한으로 auth 사용자 삭제) 전용 — Settings → API의 "service_role secret" 키. **RLS를 완전히 우회하는 비밀 키라 절대 `.env.local`(클라이언트 번들)에 넣지 말고 반드시 여기(`notebooks/.env`, 서버 전용)에만 둘 것** | 필수 (계정 탈퇴 기능용) |

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
5. Settings → API에서 **service_role secret** 키 확인 → `notebooks/.env`의 `SUPABASE_SERVICE_ROLE_KEY`에 반영 (계정 탈퇴 기능에 필요 — 절대 `.env.local`에 넣지 말 것)

## 배포

Vercel에 GitHub 저장소를 연결하면 바로 배포됩니다 (Next.js 앱이라 별도 설정 거의 불필요).
배포 후 위 환경변수를 Vercel 프로젝트 Settings에 추가하고 Redeploy 해야 반영됩니다.
