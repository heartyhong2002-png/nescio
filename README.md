# Nescio

[English version](./README.en.md)

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
notebooks/.env           로컬 개발용 API 키 (커밋되지 않음, 아래 환경변수 참고)
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

`notebooks/.env`에 아래 값을 채우면 실제 시세/뉴스/AI 분석이 동작합니다. (Vercel에 배포할
때는 이 파일 대신 프로젝트 Settings → Environment Variables에 똑같이 넣어주면 됩니다.)

| 변수 | 용도 | 필수 |
|---|---|---|
| `NVIDIA_API_KEY` | 1단계 사실 분석 (NVIDIA) | 필수 |
| `XAI_API_KEY` | 2단계 캐릭터 톤 재작성 (xAI Grok) | 필수 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 관련 뉴스 검색 (네이버 뉴스 API) | 필수 |
| `KRX_AUTH_KEY` | 종목 목록·일별 시세 (KRX Open API) | 필수 |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 분봉·기간별 차트, PER/PBR/배당/시가총액 (한국투자증권 Open API) | 필수 |
| `NVIDIA_MODEL` / `XAI_MODEL` | 각 단계에서 쓸 모델명 오버라이드 | 선택 (기본값 있음) |
| `KIS_BASE_URL` | KIS API 베이스 URL 오버라이드 (기본: 실전 `openapi.koreainvestment.com:9443`) | 선택 |

## 배포

Vercel에 GitHub 저장소를 연결하면 바로 배포됩니다 (Next.js 앱이라 별도 설정 거의 불필요).
배포 후 위 환경변수를 Vercel 프로젝트 Settings에 추가하고 Redeploy 해야 반영됩니다.
