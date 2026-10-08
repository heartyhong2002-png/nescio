# 프로젝트 구조

이 문서는 파일을 찾는 출발점입니다. 서비스 코드는 `src/` 밖에서 import하지 않습니다.

```
src/
  app/          URL 화면과 API Route Handler
  components/   여러 화면에서 공유하는 UI
  lib/          도메인 로직, 외부 데이터 연동, 인증, 상태, 공용 타입
  proxy.ts      세션 갱신과 경로 접근 제어

docs/           운영 문서와 Supabase 스키마
tools/          서비스 런타임과 분리된 로컬 실험·검증 도구
archive/        현재 서비스에서 사용하지 않는 과거 산출물
public/         브라우저에 그대로 제공하는 정적 파일
```

## `src/lib` 찾기 표

| 찾는 대상 | 파일 |
| --- | --- |
| 주가·차트·밸류에이션 | `kis.ts`, `krx.ts`, `naver-stock.ts` |
| 공모주 | `src/app/ipo/page.tsx`, `src/app/ipo/[corpCode]/page.tsx`, `dart.ts`, `ipo-*.ts` |
| 환율·매크로 | `exim.ts`, `macro-*.ts`, `market-comment.ts` |
| 증권사 리포트·컨센서스 | `consensus-*.ts` |
| 인증·사용자 데이터 | `supabase/`, `*-context.tsx`, `storage.ts`, `require-auth.ts` |
| 브라우저 데이터 요청 | `use-*.ts` |
| 공용 모델·표현 | `types.ts`, `format.ts`, `sectors.ts` |

## 유지 규칙

- 새 서비스 화면은 `src/app/`, 재사용 UI는 `src/components/`, 서버·도메인 로직은 `src/lib/`에 둡니다.
- URL을 바꾸지 않는 정리용 폴더가 필요하면 Next.js의 route group 또는 `_` private folder를 사용합니다.
- `tools/`와 `archive/`의 파일은 앱 빌드나 배포에 의존하지 않게 유지합니다.
- 서버 전용 로컬 키는 `tools/notebooks/.env`에 두고 Git에 추가하지 않습니다.
