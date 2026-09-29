-- ==========================================================================
-- Nescio 스키마 마이그레이션 v001: stock_analyses 컬럼명 정규화 + RLS 강화
--
-- 배경: 실제 DB의 stock_analyses는 name/tone 컬럼을 사용하지만, API 코드와
-- docs/supabase-schema.sql은 stock_name/generated_at(+created_at)을 전제한다.
-- 이 마이그레이션은 "코드와 문서 기준"으로 통일한다 — 코드와 문서를 바꾸는 것보다
-- DB를 맞추는 편이 안전하다(코드 수정 범위가 넓고 누락 위험이 크다).
--
-- ⚠️ 운영 DB에 적용하기 전에 반드시 staging에서 먼저 검증하세요.
-- ⚠️ 적용 전 pg_dump로 전체 백업을 권장합니다.
-- ==========================================================================

-- 1. stock_analyses: 컬럼명 정규화 및 created_at 보강
-- name → stock_name (API·문서와 일치시킨다)
ALTER TABLE public.stock_analyses
  RENAME COLUMN name TO stock_name;

-- created_at 컬럼 추가 (실제 DB에 누락되어 정렬/인덱스 에러 방지)
ALTER TABLE public.stock_analyses
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- tone 컬럼: API에서 insert 시 사용하지 않지만, 기존 데이터에 값이 있을 수 있다.
-- 삭제하지 않고 nullable로 유지하되, 문서에 deprecated로 기록한다.
-- (데이터 유실 방지. 충분한 시간이 지나면 별도 마이그레이션으로 삭제.)

-- 2. handle_new_user() 함수의 공개 EXECUTE 권한 제거
-- trigger에서 호출하는 것은 영향 없음 (trigger owner의 권한으로 실행되므로).
-- public이나 authenticated 롤에서 SELECT public.handle_new_user()로 임의 호출하는 것을 방지.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

-- 3. RLS 정책의 auth.uid() 서브쿼리 최적화
-- Supabase 권고: (select auth.uid())를 사용하면 쿼리 플래너가 한 번만 평가한다.
-- 기존 정책을 DROP 후 재생성한다.

-- profiles
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;

CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- watchlist_items
DROP POLICY IF EXISTS "watchlist: select own" ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist: insert own" ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist: update own" ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist: delete own" ON public.watchlist_items;

CREATE POLICY "watchlist: select own" ON public.watchlist_items
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "watchlist: insert own" ON public.watchlist_items
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "watchlist: update own" ON public.watchlist_items
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "watchlist: delete own" ON public.watchlist_items
  FOR DELETE USING ((select auth.uid()) = user_id);

-- stock_analyses
DROP POLICY IF EXISTS "stock_analyses: select own" ON public.stock_analyses;
DROP POLICY IF EXISTS "stock_analyses: insert own" ON public.stock_analyses;

CREATE POLICY "stock_analyses: select own" ON public.stock_analyses
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "stock_analyses: insert own" ON public.stock_analyses
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- valuation_interpretations
DROP POLICY IF EXISTS "valuation_interpretations: select own" ON public.valuation_interpretations;
DROP POLICY IF EXISTS "valuation_interpretations: insert own" ON public.valuation_interpretations;

CREATE POLICY "valuation_interpretations: select own" ON public.valuation_interpretations
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "valuation_interpretations: insert own" ON public.valuation_interpretations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ==========================================================================
-- RLS 검증 쿼리 (두 테스트 사용자로 격리 확인용 — staging에서 실행)
-- ==========================================================================
-- 아래 쿼리는 Supabase SQL Editor에서 실행한다.
-- <USER_A_UUID>와 <USER_B_UUID>를 실제 테스트 사용자 UUID로 교체해야 한다.
--
-- -- User A로 로그인한 상태 시뮬레이션:
-- set role authenticated;
-- set request.jwt.claim.sub = '<USER_A_UUID>';
-- select count(*) from watchlist_items;          -- User A 소유 행만 보여야 함
-- select count(*) from stock_analyses;           -- User A 소유 행만 보여야 함
-- select count(*) from valuation_interpretations; -- User A 소유 행만 보여야 함
-- insert into watchlist_items (user_id, ticker, name, market)
--   values ('<USER_B_UUID>', 'TEST', 'Test', 'KOSPI');  -- RLS 위반으로 실패해야 함
--
-- -- User B로 전환:
-- set request.jwt.claim.sub = '<USER_B_UUID>';
-- select count(*) from watchlist_items;          -- User B 소유 행만 보여야 함
-- delete from watchlist_items where user_id = '<USER_A_UUID>';  -- 0 rows 또는 실패
--
-- -- handle_new_user() 직접 호출 차단 검증:
-- set role authenticated;
-- select public.handle_new_user();  -- permission denied 에러가 나와야 함
-- reset role;
