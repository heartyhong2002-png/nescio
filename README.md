# nescio DB backups

`.github/workflows/db-backup.yml`(main 브랜치)가 매일 자동으로 커밋하는 브랜치입니다.
손으로 직접 편집하지 마세요.

- `backups/YYYY-MM-DD.sql`: 해당 날짜의 `public` 스키마(profiles, watchlist_items) 덤프
- 30일치만 보관하고 오래된 파일은 자동 삭제됩니다(git 히스토리에는 남아있음)
- `auth` 스키마(계정 자체)는 포함하지 않습니다 — Supabase가 관리하는 영역이라 SQL로 직접
  복원하면 오히려 깨질 수 있어서 의도적으로 뺐습니다. 목적은 "실수로 지워진 계정이 담아뒀던
  관심종목/투자성향을 참고 복구"용입니다.

## 복구하는 법

\`\`\`bash
psql "<Supabase 연결 문자열>" -f backups/2026-09-02.sql
\`\`\`
