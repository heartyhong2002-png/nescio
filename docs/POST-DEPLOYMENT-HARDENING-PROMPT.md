# 배포 전 운영 상태 마무리 프롬프트

아래 블록을 다른 AI에게 전달한다. 비밀값은 절대 읽거나 출력하거나 기록하지 않는다.

```text
Nescio main의 코드·자동 테스트 게이트는 통과했지만, 실제 운영 상태를 마무리 검증해야 한다.
코드 계약을 불필요하게 바꾸지 말고, 먼저 git status와 최신 커밋을 확인해.

현재 확인된 상태
- npm test(15개), lint, tsc, build, npm audit --omit=dev는 통과했다.
- DB에는 stock_analyses의 stock_name/created_at 정규화가 반영돼 있다.
- docs/migrations/v002_remove_legacy_stock_analyses_policy.sql의 정책 삭제는 운영 DB에 적용됐고, Advisor 재검증도 통과했다. 재적용하지 마.
- db-backups 브랜치에는 아직 SQL 덤프가 없으므로, 워크플로 코드·mock 테스트와 별개로 실제 GitHub Actions 실행 성공은 검증되지 않았다.

작업 1 — Supabase 보안 설정
1. Supabase Security Advisor를 실행한다.
2. leaked password protection이 켜져 있는지 확인하고, 꺼져 있으면 Supabase Dashboard의 Authentication 보안 설정에서 활성화한다. 비밀값·사용자 데이터는 보지 않는다.
3. Supabase migration history에는 v002만 기록돼 있고 v001은 직접 SQL 적용 이력임을 문서화한다. 임의로 DB를 다시 변경하지 말고 이후 표준 migration 관리 전환 계획을 제시한다.

작업 2 — 실제 DB backup workflow 검증
1. GitHub Actions에서 DB Backup workflow를 workflow_dispatch로 한 번 실행한다. 실행 전 `SUPABASE_DB_URL`의 값이 아니라 Secret의 존재 여부만 확인한다.
2. workflow가 성공했는지, db-backups 브랜치에 UTC 당일 `backups/YYYY-MM-DD.sql`이 생겼는지 파일명만 확인한다. SQL 내용은 열지 않는다.
3. 30일 초과 백업 정리·commit·push 단계가 실행 로그에서 성공했는지 확인한다.
4. 실패하면 workflow를 성공으로 처리하지 말고, 실패 단계·재현 조건·최소 수정안을 보고한다.

작업 3 — 의존성 및 CI 일치
1. package.json과 package-lock에서 next와 eslint-config-next가 모두 16.3.7인지 확인한다.
2. npm test, npm run lint, npx tsc --noEmit, npm run build, npm audit --omit=dev를 순서대로 실행한다.
3. CI의 Node 버전과 로컬 지원 범위를 확인하고, CI 실행 결과를 읽기 전용으로 확인한다.

완료 기준
- leaked password protection 활성화 또는 불가 사유 명시
- migration history의 부분 추적 상태를 기록
- 실제 backup workflow 성공 및 파일명만으로 산출물 확인
- 전체 검증 통과 결과와 남은 운영 리스크를 docs/PR-2-QUALITY-DEPLOYMENT-REPORT.md와 docs/HANDOFF.md에 반영
- 미해결 P0/P1이 있으면 READY FOR DEPLOYMENT라고 선언하지 않는다.
```
