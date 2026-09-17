-- nescio: 계정/관심종목 DB 스키마
--
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하면 된다. 두 테이블(profiles, watchlist_items)
-- 모두 auth.uid() 기준 Row Level Security를 걸어서, 각자 자기 데이터만 읽고 쓸 수 있다.
-- recentSearches(최근 검색어)는 계정 데이터가 아니라 브라우저 로컬 캐시로만 유지하므로 여기 없음.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  persona text check (persona in ('beginner','general','expert')),
  sectors text[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);
-- insert 정책은 필요 없음 — 아래 트리거가 security definer로 대신 insert하기 때문에
-- 클라이언트가 직접 profiles에 insert할 일이 없다.

-- 회원가입(auth.users에 새 행 생성) 시 profiles 행을 자동으로 만들어준다. 앱 코드가 "가입 후
-- 프로필 생성"을 별도로 호출할 필요가 없어진다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text not null,
  market text not null,
  added_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.watchlist_items enable row level security;

create policy "watchlist: select own" on public.watchlist_items
  for select using (auth.uid() = user_id);
create policy "watchlist: insert own" on public.watchlist_items
  for insert with check (auth.uid() = user_id);
-- update 정책도 필요하다 — 앱 코드(add/addMany)가 upsert(insert ... on conflict do update)를
-- 쓰는데, RLS가 걸린 테이블에서 upsert는 insert 정책만으로는 통과하지 않고 update 정책도
-- 같이 확인한다. 이게 빠지면 이미 담은 종목을 다시 담으려 할 때(on conflict 경로) permission
-- denied로 조용히 실패하고 롤백된다.
create policy "watchlist: update own" on public.watchlist_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist: delete own" on public.watchlist_items
  for delete using (auth.uid() = user_id);

-- 실행 후 확인해볼 것 (SQL Editor에서):
--   set role authenticated;
--   set request.jwt.claim.sub = '<테스트용 다른 uuid>';
--   select * from public.watchlist_items; -- 그 uuid 소유가 아닌 행은 하나도 안 보여야 정상

-- ---------------------------------------------------------------------------
-- stock_analyses / valuation_interpretations: AI가 만든 종목 요약본 히스토리
--
-- 종목 상세 페이지(/stock/[ticker])를 열 때마다 서버가 새로 만드는 AI 브리핑(원인 분석 +
-- "쩐형" 코멘트)과 재무지표 해설을, 로그인한 사용자에 한해 버전으로 계속 쌓아 남긴다.
-- watchlist_items처럼 "현재 값 하나"가 아니라 "매번 새로 생성된 스냅샷"이라 unique 제약을
-- 걸지 않고 created_at 기준으로 여러 행이 쌓이게 둔다. 저장은 /api/analyze,
-- /api/valuation/interpret 라우트가 응답 직전에 서버 사이드에서 처리한다(클라이언트가 직접
-- insert하지 않음) — 그래서 insert 정책도 select 정책과 함께 "본인 것만"으로 걸어둔다.
-- ---------------------------------------------------------------------------

create table public.stock_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  stock_name text not null,
  price jsonb not null,        -- Price 타입 스냅샷 (close/changeRate/marketCap)
  news jsonb not null default '[]', -- NewsItem[] — 이 브리핑이 근거로 쓴 뉴스 목록
  briefing jsonb not null,     -- Briefing 타입 (oneLiner/causes/aiComment) 전체
  generated_at timestamptz not null, -- analyze route가 응답에 찍은 생성 시각
  created_at timestamptz not null default now()
);

create index stock_analyses_user_ticker_idx
  on public.stock_analyses (user_id, ticker, created_at desc);

alter table public.stock_analyses enable row level security;

create policy "stock_analyses: select own" on public.stock_analyses
  for select using (auth.uid() = user_id);
create policy "stock_analyses: insert own" on public.stock_analyses
  for insert with check (auth.uid() = user_id);
-- update/delete 정책 없음 — 히스토리는 쌓이기만 하고 수정하지 않는다(필요해지면 그때 추가).

create table public.valuation_interpretations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  stock_name text not null,
  metrics jsonb not null,         -- 해설을 만들 때 입력한 {per, pbr, dividend, marketCap}
  interpretation jsonb not null,  -- ValuationInterpretation 타입 전체
  created_at timestamptz not null default now()
);

create index valuation_interpretations_user_ticker_idx
  on public.valuation_interpretations (user_id, ticker, created_at desc);

alter table public.valuation_interpretations enable row level security;

create policy "valuation_interpretations: select own" on public.valuation_interpretations
  for select using (auth.uid() = user_id);
create policy "valuation_interpretations: insert own" on public.valuation_interpretations
  for insert with check (auth.uid() = user_id);
