--
-- PostgreSQL database dump
--

\restrict fL7bjyfaaInrmLbbideb6tAhQgENiUTjsnstru5GvCVmvd5RjSYXUXQcawFsJIg

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    persona text,
    sectors text[] DEFAULT '{}'::text[] NOT NULL,
    onboarded boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_persona_check CHECK ((persona = ANY (ARRAY['beginner'::text, 'general'::text, 'expert'::text])))
);


--
-- Name: stock_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    stock_name text NOT NULL,
    price jsonb NOT NULL,
    news jsonb NOT NULL,
    briefing jsonb NOT NULL,
    tone text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: valuation_interpretations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valuation_interpretations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    stock_name text NOT NULL,
    metrics jsonb NOT NULL,
    interpretation jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: watchlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watchlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    name text NOT NULL,
    market text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, persona, sectors, onboarded, created_at) FROM stdin;
aedc96f9-b872-4a87-8719-ac72491432d9	general	{internet-ai,semiconductor,battery}	t	2026-09-02 16:11:54.478023+00
\.


--
-- Data for Name: stock_analyses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_analyses (id, user_id, ticker, stock_name, price, news, briefing, tone, generated_at, created_at) FROM stdin;
\.


--
-- Data for Name: valuation_interpretations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.valuation_interpretations (id, user_id, ticker, stock_name, metrics, interpretation, created_at) FROM stdin;
\.


--
-- Data for Name: watchlist_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.watchlist_items (id, user_id, ticker, name, market, added_at) FROM stdin;
e6335263-72bf-4331-b5d5-a985d6f4cb74	aedc96f9-b872-4a87-8719-ac72491432d9	005930	삼성전자	KOSPI	2026-09-02 16:12:07.174915+00
3b357eb6-bd44-475b-af0b-c4458a29fa26	aedc96f9-b872-4a87-8719-ac72491432d9	000660	SK하이닉스	KOSPI	2026-09-02 16:12:07.712949+00
a39b7c7f-791a-4a38-aca5-564b2b82cd4d	aedc96f9-b872-4a87-8719-ac72491432d9	095500	미래나노텍	KOSDAQ	2026-09-02 16:13:27.562554+00
437da74a-f221-41da-9799-1fecf014aa85	aedc96f9-b872-4a87-8719-ac72491432d9	475230	엔알비	KOSDAQ	2026-09-02 16:13:33.235273+00
bd6039a0-defc-4eab-80a6-6bf43d704405	aedc96f9-b872-4a87-8719-ac72491432d9	458650	성우	KOSDAQ	2026-09-02 16:13:38.459821+00
be810927-e582-47a8-9007-563134d12709	aedc96f9-b872-4a87-8719-ac72491432d9	475580	에이럭스	KOSDAQ	2026-09-02 16:13:43.80571+00
8df90487-a10b-4a1e-b559-c77c65e44640	aedc96f9-b872-4a87-8719-ac72491432d9	163280	에어레인	KOSDAQ	2026-09-02 16:13:47.749711+00
b29744cc-d7ed-4d02-843f-b02948288e88	aedc96f9-b872-4a87-8719-ac72491432d9	336680	탑런토탈솔루션	KOSDAQ	2026-09-02 16:13:52.685694+00
2737abdc-514a-4db9-b976-a57a954c1694	aedc96f9-b872-4a87-8719-ac72491432d9	464500	아이언디바이스	KOSDAQ	2026-09-02 16:13:59.436658+00
4f6afe74-ad41-475f-b5c5-cd54dba80907	aedc96f9-b872-4a87-8719-ac72491432d9	373110	엑셀세라퓨틱스	KOSDAQ	2026-09-02 16:14:03.903753+00
724057ad-ca00-47bd-9de4-06fd547d1a6b	aedc96f9-b872-4a87-8719-ac72491432d9	360750	TIGER 미국S&P500	ETF	2026-09-02 16:14:27.912757+00
8b2ef706-682f-4539-b712-32d989ccb3bb	aedc96f9-b872-4a87-8719-ac72491432d9	379810	KODEX 미국나스닥100	ETF	2026-09-02 16:14:38.010028+00
1bc6d8df-3dd8-405b-ab7d-ff8f206636fa	aedc96f9-b872-4a87-8719-ac72491432d9	247540	에코프로비엠	KOSDAQ	2026-09-17 02:55:46.678723+00
0abdedd0-7512-4f30-9707-15a1fe4fda1a	aedc96f9-b872-4a87-8719-ac72491432d9	015860	일진홀딩스	KOSPI	2026-09-17 02:55:46.678723+00
82efa707-5320-4cac-ae9d-e872f91f6e90	aedc96f9-b872-4a87-8719-ac72491432d9	277810	레인보우로보틱스	KOSDAQ	2026-09-17 02:55:46.678723+00
7c7ea1fb-a27c-42c1-b9b1-b6d9762c6bd7	aedc96f9-b872-4a87-8719-ac72491432d9	006400	삼성SDI	KOSPI	2026-09-17 02:55:46.678723+00
e421d105-d1ac-4073-a2f5-dac1e78362b2	aedc96f9-b872-4a87-8719-ac72491432d9	0161M0	네오사피엔스	KOSDAQ	2026-09-21 03:13:02.608887+00
9e3f3a84-768a-47b8-aff6-d41f1035517b	aedc96f9-b872-4a87-8719-ac72491432d9	097950	CJ제일제당	KOSPI	2026-09-23 07:15:53.917501+00
582a513c-0179-462f-a0ea-8b48a391ab38	aedc96f9-b872-4a87-8719-ac72491432d9	042700	한미반도체	KOSDAQ	2026-09-24 10:01:20.854259+00
c7dbde08-f588-45e4-8eda-0b485708b584	aedc96f9-b872-4a87-8719-ac72491432d9	373220	LG에너지솔루션	KOSPI	2026-09-24 10:01:20.854259+00
4509a42c-228a-4bea-ac03-40c73d069389	aedc96f9-b872-4a87-8719-ac72491432d9	051910	LG화학	KOSPI	2026-09-24 10:01:20.854259+00
d2d840f4-4c4c-4808-baba-7ff47d4fc156	aedc96f9-b872-4a87-8719-ac72491432d9	458730	TIGER 미국배당다우존스	ETF	2026-09-02 16:14:44.483037+00
00b971d8-5d6b-4266-8c21-ea1b599ff189	aedc96f9-b872-4a87-8719-ac72491432d9	379800	KODEX 미국S&P500	ETF	2026-09-02 16:14:54.300485+00
220c25b7-849d-4ed3-8d75-c8c94396985e	aedc96f9-b872-4a87-8719-ac72491432d9	083450	GST	KOSDAQ	2026-09-03 02:46:22.411334+00
a74640d7-4d25-4f1b-9013-84751ada313c	aedc96f9-b872-4a87-8719-ac72491432d9	034020	두산에너빌리티	KOSPI	2026-09-07 06:03:57.998922+00
9f7675ec-822b-40a9-8f9c-1bbd384a52a6	aedc96f9-b872-4a87-8719-ac72491432d9	058470	리노공업	KOSDAQ	2026-09-17 02:55:46.678723+00
34d75c33-fe11-48b0-b944-4381d854ed65	aedc96f9-b872-4a87-8719-ac72491432d9	006660	삼성공조	KOSPI	2026-09-17 02:55:46.678723+00
894bbc33-0097-4068-b0ef-8a520a296688	aedc96f9-b872-4a87-8719-ac72491432d9	0010S0	와이즈플래닛컴퍼니	KOSDAQ	2026-09-23 07:23:49.039363+00
fbb92297-3816-4dd5-939f-b08e3fe99a90	aedc96f9-b872-4a87-8719-ac72491432d9	009150	삼성전기	KOSPI	2026-09-28 12:48:01.302969+00
4b0919bc-58a9-4212-9a25-9c1c8c292510	aedc96f9-b872-4a87-8719-ac72491432d9	259960	크래프톤	KOSPI	2026-09-28 12:48:01.302969+00
50055d2d-712c-4eaf-90ee-b4e31b5bcc0a	aedc96f9-b872-4a87-8719-ac72491432d9	487570	HS효성	KOSPI	2026-09-28 12:48:01.302969+00
ccab9aa0-0a19-4a2d-998e-069653fa3a9f	aedc96f9-b872-4a87-8719-ac72491432d9	399720	가온칩스	KOSDAQ	2026-09-28 12:48:01.302969+00
28713888-fd30-4fba-b277-756ed650b81b	aedc96f9-b872-4a87-8719-ac72491432d9	388720	유일로보틱스	KOSDAQ	2026-09-28 12:48:01.302969+00
95eac1d2-654f-4671-85ec-94dde32a0ca7	aedc96f9-b872-4a87-8719-ac72491432d9	225570	넥슨게임즈	KOSDAQ	2026-09-28 12:48:01.302969+00
b06e5f69-78b0-4087-aec6-c4f9625ba330	aedc96f9-b872-4a87-8719-ac72491432d9	003680	한성기업	KOSPI	2026-09-28 12:48:01.302969+00
c5ff9166-0cd0-45bb-be76-c717872376fd	aedc96f9-b872-4a87-8719-ac72491432d9	034120	SBS	KOSPI	2026-09-28 12:48:01.302969+00
84fcbe41-e71a-4d4a-9e04-9e49d9477274	aedc96f9-b872-4a87-8719-ac72491432d9	024060	흥구석유	KOSDAQ	2026-09-28 12:48:01.302969+00
0a0f0182-8f66-41ac-8855-a163ba37b832	aedc96f9-b872-4a87-8719-ac72491432d9	0035S0	빅웨이브로보틱스	KOSDAQ	2026-09-28 14:25:48.703837+00
\.


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: stock_analyses stock_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_analyses
    ADD CONSTRAINT stock_analyses_pkey PRIMARY KEY (id);


--
-- Name: valuation_interpretations valuation_interpretations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_interpretations
    ADD CONSTRAINT valuation_interpretations_pkey PRIMARY KEY (id);


--
-- Name: watchlist_items watchlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_items
    ADD CONSTRAINT watchlist_items_pkey PRIMARY KEY (id);


--
-- Name: watchlist_items watchlist_items_user_id_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_items
    ADD CONSTRAINT watchlist_items_user_id_ticker_key UNIQUE (user_id, ticker);


--
-- Name: stock_analyses_user_ticker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_analyses_user_ticker_idx ON public.stock_analyses USING btree (user_id, ticker, generated_at DESC);


--
-- Name: valuation_interpretations_user_ticker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX valuation_interpretations_user_ticker_idx ON public.valuation_interpretations USING btree (user_id, ticker, created_at DESC);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stock_analyses stock_analyses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_analyses
    ADD CONSTRAINT stock_analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: valuation_interpretations valuation_interpretations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valuation_interpretations
    ADD CONSTRAINT valuation_interpretations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: watchlist_items watchlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watchlist_items
    ADD CONSTRAINT watchlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles: select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: profiles profiles: update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: stock_analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_analyses stock_analyses: insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stock_analyses: insert own" ON public.stock_analyses FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: stock_analyses stock_analyses: select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stock_analyses: select own" ON public.stock_analyses FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: valuation_interpretations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.valuation_interpretations ENABLE ROW LEVEL SECURITY;

--
-- Name: valuation_interpretations valuation_interpretations: insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "valuation_interpretations: insert own" ON public.valuation_interpretations FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: valuation_interpretations valuation_interpretations: select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "valuation_interpretations: select own" ON public.valuation_interpretations FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: watchlist_items watchlist: delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "watchlist: delete own" ON public.watchlist_items FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: watchlist_items watchlist: insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "watchlist: insert own" ON public.watchlist_items FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: watchlist_items watchlist: select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "watchlist: select own" ON public.watchlist_items FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: watchlist_items watchlist: update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "watchlist: update own" ON public.watchlist_items FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: watchlist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict fL7bjyfaaInrmLbbideb6tAhQgENiUTjsnstru5GvCVmvd5RjSYXUXQcawFsJIg

