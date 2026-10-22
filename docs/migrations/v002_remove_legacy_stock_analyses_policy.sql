-- v002: stock_analyses의 이전 ALL 정책 제거
--
-- v001 이후 "stock_analyses: select own" 및 "stock_analyses: insert own"이
-- 소유자 조건을 담당한다. 이전 "stock_analyses: 본인만" ALL 정책은 중복된 permissive
-- 정책이어서 RLS planner 경고를 만들고, 의도하지 않은 update/delete 권한을 남긴다.
-- 이 migration은 운영 DB에 2026-09-29 적용됐다.

DROP POLICY IF EXISTS "stock_analyses: 본인만" ON public.stock_analyses;
