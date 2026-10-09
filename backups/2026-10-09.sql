--
-- PostgreSQL database dump
--

\restrict wZxubw1PKkVwqDzWQMEae4zpaoKhpRPa43pP1S7NfNDbgDgTM6ictPsRMcI4Fl9

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
292eb713-4f2a-4676-9d17-5b94e76a06c2	aedc96f9-b872-4a87-8719-ac72491432d9	0035S0	빅웨이브로보틱스	{"close": 38850, "marketCap": 399005467350, "changeRate": 29.93}	[{"link": "http://www.kjdaily.com/article.php?aid=1790826796688054276", "title": "SK하이닉스·삼성전자 3조4천억원 거래…반도체주 상위권", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 12:56:00 +0900", "language": "ko", "description": "빅웨이브로보틱스는 2천216억8398만원이 거래됐지만 주가는 3만5천950원으로 7.46% 하락했다. 덕산넵코어스는 2천197억7965만원의 거래대금을 기록했다. 주가는 1만8천160원으로 1.00% 상승했다...."}, {"link": "http://www.kjdaily.com/article.php?aid=1790826280688053276", "title": "브릴스 회전율 78%…코스모로보틱스·덕산넵코어스 60% 넘어", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 12:46:00 +0900", "language": "ko", "description": "이미지=아이클릭아트<1일 오전 주식 회전율 상위 20개 종목 분석> -브릴스 78.50% 1위…상장 첫날 892만주 거래 -코스모로보틱스 64.48%·덕산넵코어스 62.17% -빅웨이브로보틱스 59.39%…회전율 50% 이상 4개..."}, {"link": "https://www.newstnt.com/news/articleView.html?idxno=721006", "title": "[특징주] 외국인·기관, 삼성전자 '팔자'… 코스모로보틱스는 수급 엇갈...", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 11:54:00 +0900", "language": "ko", "description": "오전 10시에는 외국인 순매수 상위가 앱튼, 모아데이타(288980), 드림텍(192650), 후성(093370), 빅웨이브로보틱스(0035S0)로 바뀌었다. 순매도 상위에는 KBI동양철관, 우리금융지주, KG스틸, 삼성전자, 동국제강(460860)이..."}, {"link": "https://www.safetimes.co.kr/news/articleView.html?idxno=246154", "title": "코스모로보틱스 \\"매출 적법\\" … 수사 성실히 협조", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 10:52:00 +0900", "language": "ko", "description": "유진투자증권은 빅웨이브로보틱스 IPO에서 증권신고서 정정 요구 이후 비교기업과 가치평가 근거를 보완한 데 이어, 코스모로보틱스에선 NH투자증권과 공동대표 주관사를 맡았다. 다만 두 사례의 사실관계와 공모..."}, {"link": "https://www.news2day.co.kr/article/20261001500081", "title": "[N2 증시 풍향계] 반도체 소부장·철강株 대거 ‘불기둥’…현대모비스...", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 10:30:00 +0900", "language": "ko", "description": "이번 주 앞서 상장한 빅웨이브로보틱스와 글로벌테크놀로지, 덕산넵코어스의 주가 흐름은 엇갈리고 있다. 같은 시각 빅웨이브로보틱스와 글로벌테크놀로지는 각각 9.91%와 5.08% 내리며 2거래일 약세를 지속하고..."}, {"link": "https://www.joongangenews.com/news/articleView.html?idxno=551829", "title": "빅웨이브로보틱스 주가, 35,150원 9.52% 하락", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 10:20:00 +0900", "language": "ko", "description": "|중앙이코노미뉴스 조용우 기자|출처=네이버페이 증권 1일(미국 동부 기준 30일) 기준, 네이버페이 증권에 따르면 빅웨이브로보틱스가 정규장 중 지난 종가 대비 큰 폭으로 하락하고 있다. 현재 주가는 35,150원을..."}, {"link": "http://www.smedaily.co.kr/news/articleView.html?idxno=363981", "title": "몸값 1조 '엘리스그룹' IPO 도전", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 10:18:00 +0900", "language": "ko", "description": "지난달 29일 코스닥시장에 입성한 빅웨이브로보틱스는 전날까지 공모가(1만8000원) 대비 115.83% 상승했다. 같은 날 코스닥에 상장한 글로벌테크놀로지도 공모가(1만원) 대비 91.00% 뛰면서 강세를 자랑했다. 김학준..."}, {"link": "https://biz.newdaily.co.kr/site/data/html/2026/10/01/2026100100080.html", "title": "美 국채금리 급등에 코스피 6770선 후퇴 … 코스닥은 외인 매수에 상승", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 09:42:00 +0900", "language": "ko", "description": "로봇 및 부품 관련주 중에서는 빅웨이브로보틱스가 3만5150원, 브릴스가 4만7800원, DS 덕산넵코어스가 1만9180원을 나타냈다. 업종별로는 게임엔터테인먼트(+2.75%), 제약(+2.28%), 자동차부품(+2.13%), 레저용장비와제품..."}, {"link": "https://www.pinpointnews.co.kr/news/articleView.html?idxno=491742", "title": "로봇株 다시 달아오른다…브릴스 폭등에 부품·스마트팩토리주 '함박웃...", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 09:40:00 +0900", "language": "ko", "description": "빅웨이브로보틱스는 9.65% 하락한 3만5100원에 거래되고 있다. 최근 주가가 빠르게 상승한 데 따른 차익 매물이 출회되면서 조정을 받고 있는 것으로 풀이된다. 로봇 플랫폼과 자동화 솔루션 관련주 가운데서는 로보티즈..."}, {"link": "https://www.news2day.co.kr/article/20261001500031", "title": "\\"4분기 IPO 시장 회복 전망…AI·반도체·로봇 기업 주목\\"<KB證>", "source": "네이버뉴스", "pubDate": "Thu, 01 Oct 2026 09:16:00 +0900", "language": "ko", "description": "같은 날 상장한 로봇 자동화 플랫폼·피지컬 AI 기업 '빅웨이브로보틱스'는 공모가 1만8000원보다 116% 높은 수준으로 거래를 마쳤다. 지난달 21일 상장한 '네오사피엔스'도 30일 종가 기준 공모가를 73% 웃돌았다. 태..."}, {"link": "https://news.google.com/rss/articles/CBMib0FVX3lxTE9nYk9tTktIVER1eUhwOEZ6MXBFQklEZWhVVFgwSDF1MHVNVUpvRDVPRG1vZ2d5blA0WTRzWV9MZjU5N0VoY2dKT0RhWi1jMVZBd1h4Y01RTkZxVG5NTnNQZnhFTWZnUFRSQ2F1dHlrWQ?oc=5", "title": "코스모 하한가·빅웨이브 상한가…엇갈린 로봇 새내기주", "source": "뉴스톱", "pubDate": "Wed, 30 Sep 2026 21:36:21 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMib0FVX3lxTE9nYk9tTktIVER1eUhwOEZ6MXBFQklEZWhVVFgwSDF1MHVNVUpvRDVPRG1vZ2d5blA0WTRzWV9MZjU5N0VoY2dKT0RhWi1jMVZBd1h4Y01RTkZxVG5NTnNQZnhFTWZnUFRSQ2F1dHlrWQ?oc=5\\" target=\\"_blank\\">코스모 하한가·빅웨이브 상한가…엇갈린 로봇 새내기주</a> <font color=\\"#6f6f6f\\">뉴스톱</font>"}, {"link": "https://news.google.com/rss/articles/CBMibEFVX3lxTE93RGU1X20yS09RX2xlb1o0WUpRUVpROUZVby1pSHA2STNCckpReEFXUnR2WHh3dWxPdEtySXNSLU1DbWVNUWZ6QXVmckVuQ25BZC1qeExuQTJTOGo2N0tyTHZuMGlRNlMtZmFaNA?oc=5", "title": "[사진] 빅웨이브로보틱스 코스닥 시장 성공적 입성", "source": "로봇신문", "pubDate": "Tue, 29 Sep 2026 08:48:47 GMT", "language": "ko", "description": "<ol><li><a href=\\"https://news.google.com/rss/articles/CBMibEFVX3lxTE93RGU1X20yS09RX2xlb1o0WUpRUVpROUZVby1pSHA2STNCckpReEFXUnR2WHh3dWxPdEtySXNSLU1DbWVNUWZ6QXVmckVuQ25BZC1qeExuQTJTOGo2N0tyTHZuMGlRNlMtZmFaNA?oc=5\\" target=\\"_blank\\">[사진] 빅웨이브로보틱스 코스닥 시장 성공적 입성</a> <font color=\\"#6f6f6f\\">로봇신문</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiW0FVX3lxTE0yUWE3d1hLcjdIUVVRRkI5ekJvcDlCeTBfTms4dWtVbU5qVzB6OGI3azN4aEI2eTFzN3M3SnBjU0hyenkzeUY4dHhZUHBZTjdLaEgwZ2NIdVpia0XSAWBBVV95cUxQa3d2ZGtNeS1oOWgyWDJaaktaNS1jRDllTGRwNW1GM01aODhWS2Z5S3ZrM0hoVW9RYlg0Z1JJYXBGdVBOc0hua2RUTXd3SjFkU1Vrd2pWRU1KOEwxdkRYTmk?oc=5\\" target=\\"_blank\\">[특징주] 글로벌테크놀로지·빅웨이브로보틱스, 상장 첫날 급등(종합)</a> <font color=\\"#6f6f6f\\">연합뉴스</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMijwFBVV95cUxOVURLWVpOYlp3LWNiWm1nZXZmcmtoM09Dd1JsdmVsSEpjeFRaR1ZqbXhzZ3UyZDhJX2VIUFg2dDBSSVktR1NNQmJ4SE1PZFAxOXRVUnJwTzJxN2pvXzhhVnNZQnduZW5uWDZyd3ZzOHpWd1k1Q1UwUjlfZk5pNEk3bGJmcTNtZ0hYN2ZjdUxHSQ?oc=5\\" target=\\"_blank\\">[빅웨이브로보틱스 IPO] 흥행 마무리에도 복잡한 셈법…유진증권 몫은 4.5억 : 네이버 블로그</a> <font color=\\"#6f6f6f\\">Naver Blog</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiaEFVX3lxTE5CSmJGT3hocko4OUxLZngzOXhJXy1uTkFBUXE4aFp2MEQ3WVpyTlhpVHBtajROOER1SGh5YmFRNGVxbm9CNVZzOEM5V2hxOXZYZTVBczF5c2EwREQwOEFzOUdDTmNsRGho0gFuQVVfeXFMUGlrZzRGU2NDZ01lTEJ1SUQ1cWhRZlE1NGw0T3p5a3l0UXNkeHY4VURmWnZFdi0xZjN3Um83SEJwVTRyQjVqbzQzOUg4Mm1LZ1ZCNEZ2amZuM1hTNUpJNXBEQS12M0tCZEhaQ2FUa0E?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스, 코스닥 상장 첫날 210%대 급등 - 머니투데이</a> <font color=\\"#6f6f6f\\">머니투데이</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMic0FVX3lxTE5MdHEzejFJQmVRTHltbGFPcG9DX3BKZUF0ZXZ1NzExSTZ2U0FyNHJUWmlITFZrTHlITE5udFA2ZFl1TlQ1VmRZTDk1RzJfMEE2SlJzNFFjTjluTXBpbE5hZjZ3UFZudE5CUU94dmxWQk50ZEU?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스 코스닥 상장 첫날 장중 주가 공모가보다 210%대 상승</a> <font color=\\"#6f6f6f\\">businesspost.co.kr</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiiAFBVV95cUxOWmVwRzlqQzJVNXBMZWtGRjgzRXRoYlBmSTVXUi1oSk9TeUdqWllrU3ozME5pMVE1b0tkb3ZQZUZLakYzOGpDYy1GLW1uTlFOWm5GWk4tbGN4NktmSVU5eEhLUlhCcE1lM3FxQnl1UllmWEN2cVVEMVpKMGFtWmptV0NCRnBjU3Jm0gGcAUFVX3lxTE81Ymh0SFlpQVJiMHdlTEF6UGJBaUdoZUtnU0J5QVhxMVdTV3VIVnRrdmRENXhIbmpqX0JQR1V4V3NrOHBCZkRMaXVPWl9tc25vMGRJYVlDNjlhbmRER19FdjNJeUFHektVTFQ0ejJMblBQemRyR045WG5VQWJMb3cxLTkwMkNzR2RpeGxWcXBRajBwLUcxYXRleHNhTg?oc=5\\" target=\\"_blank\\">[특징주] 빅웨이브로보틱스, 코스닥 입성 첫날 208% 급등 - 조선비즈</a> <font color=\\"#6f6f6f\\">Chosunbiz</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMigAFBVV95cUxQNzRIZmlTcDAyMGxDZ21ZYXotUllVVnVfRG51ZDZKSlMxWEg2TWdwVlUwUW1Fbk9aMGxmYzhtZTdRNnBlN0JSMnV0NTlOUjRmeS0xc0MwZmhzcGpCUXNEY2hjeGozRDVPekMtbVdzRVV5bk9fdDg5aWMtS285MnU0Wg?oc=5\\" target=\\"_blank\\">‘로봇 자동화 플랫폼’ 빅웨이브로보틱스, 코스닥 데뷔[오늘상장]</a> <font color=\\"#6f6f6f\\">edaily.co.kr</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiYEFVX3lxTFAxdl9GcjVKSzVQbGVLUGR3Y0JkWllEYXlDcms0ZUNnTm1DczA0Ui1NZzhTNE9pMkVXNkFBcF9pT2dMOHN0MmVyQ3NRUGc5eDdfS1RZVFJsdWs5NXI1YzVrb9IBeEFVX3lxTFBwTGd5dVBvb2ZuRm0xYU12Rm14alV5MTBuY3pjZVNVeGoxaTlyWlRPLXNfS1lKM3JjVWVDWngyUlZTc0Z5SHpYNy1yTkdFRFVzQV8zS2ZUSk9ERnUzQjN4bUl0QUJ5ZVhjeE5VdFlQYmhiNXJfYjNoZg?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스, 코스닥 상장 첫날 200%대 급등</a> <font color=\\"#6f6f6f\\">뉴시스</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiUkFVX3lxTE9HNHF3V1FHdzd5UUU2SWxqenJnMUZPWTUxaERMNDNnSWtvbFVQMV91SkY2RzRZaGVGN1hTTm1aYjVNV0xMaEdiSDdSQzRTN1ZmX0HSAVNBVV95cUxQU1pMeTRlUFdkR1E4Wi1EaERSU0ptNXZNOG83cjdyVnVoeERGNUNfZlBTQkF2dHloVTlsa3prNjVEZlpFUWJiUlRnenFpSWxuazhEYw?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스·덕산넵코어스 등 코스닥 입성 [이번주 증시 캘린더]</a> <font color=\\"#6f6f6f\\">sedaily.com</font></li></ol>"}, {"link": "https://news.google.com/rss/articles/CBMiS0FVX3lxTE9UVFhSQ3lMamg0cUhLUFhrZ2E5Q0V0a3BLUFhzbThxeFhLTW5FcDMtNVBSQnpJQnB0Y09pdzZudlVIVFBiTUg5aEwtZw?oc=5", "title": "[특징주] 글로벌테크놀로지·빅웨이브로보틱스, 상장 첫날 급등(종합)", "source": "v.daum.net", "pubDate": "Tue, 29 Sep 2026 06:39:05 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiS0FVX3lxTE9UVFhSQ3lMamg0cUhLUFhrZ2E5Q0V0a3BLUFhzbThxeFhLTW5FcDMtNVBSQnpJQnB0Y09pdzZudlVIVFBiTUg5aEwtZw?oc=5\\" target=\\"_blank\\">[특징주] 글로벌테크놀로지·빅웨이브로보틱스, 상장 첫날 급등(종합)</a> <font color=\\"#6f6f6f\\">v.daum.net</font>"}, {"link": "https://news.google.com/rss/articles/CBMiTkFVX3lxTE8tZmlZWm8wTHU1MldvMFZnZUZydUNnYUpYTEhUc2RpQUdncW5mbTJnVTFmZzVSNFdtZ05OazdaRnZTcERIbEd1eFNMT3hTZw?oc=5", "title": "[ET특징주]빅웨이브로보틱스, 코스닥 입성 첫날 급등세", "source": "전자신문", "pubDate": "Tue, 29 Sep 2026 04:13:14 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiTkFVX3lxTE8tZmlZWm8wTHU1MldvMFZnZUZydUNnYUpYTEhUc2RpQUdncW5mbTJnVTFmZzVSNFdtZ05OazdaRnZTcERIbEd1eFNMT3hTZw?oc=5\\" target=\\"_blank\\">[ET특징주]빅웨이브로보틱스, 코스닥 입성 첫날 급등세</a> <font color=\\"#6f6f6f\\">전자신문</font>"}, {"link": "https://news.google.com/rss/articles/CBMiS0FVX3lxTE15Y3lYNi1lRUlQdGFmNXBraW5yMFVwM0MwS3lReUduNHNFU2xfaGwwMVhMYjNYMHowNTNpX2N3WFU2MGRhWDFWSmlZaw?oc=5", "title": "빅웨이브로보틱스 코스닥시장 상장기념식", "source": "뉴스1", "pubDate": "Tue, 29 Sep 2026 01:55:57 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiS0FVX3lxTE15Y3lYNi1lRUlQdGFmNXBraW5yMFVwM0MwS3lReUduNHNFU2xfaGwwMVhMYjNYMHowNTNpX2N3WFU2MGRhWDFWSmlZaw?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스 코스닥시장 상장기념식</a> <font color=\\"#6f6f6f\\">뉴스1</font>"}, {"link": "https://news.google.com/rss/articles/CBMibkFVX3lxTFBpa2c0RlNjQ2dNZUxCdUlENXFoUWZRNTRsNE96eWt5dFFzZHh2OFVEZlp2RXYtMWYzd1JvN0hCcFU0ckI1am80MzlIODJtS2dWQjRGdmpmbjNYUzVKSTVwREEtdjNLQmRIWkNhVGtB0gFuQVVfeXFMUGlrZzRGU2NDZ01lTEJ1SUQ1cWhRZlE1NGw0T3p5a3l0UXNkeHY4VURmWnZFdi0xZjN3Um83SEJwVTRyQjVqbzQzOUg4Mm1LZ1ZCNEZ2amZuM1hTNUpJNXBEQS12M0tCZEhaQ2FUa0E?oc=5", "title": "빅웨이브로보틱스, 코스닥 상장 첫날 210%대 급등 - 머니투데이", "source": "머니투데이", "pubDate": "Tue, 29 Sep 2026 00:23:05 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMibkFVX3lxTFBpa2c0RlNjQ2dNZUxCdUlENXFoUWZRNTRsNE96eWt5dFFzZHh2OFVEZlp2RXYtMWYzd1JvN0hCcFU0ckI1am80MzlIODJtS2dWQjRGdmpmbjNYUzVKSTVwREEtdjNLQmRIWkNhVGtB0gFuQVVfeXFMUGlrZzRGU2NDZ01lTEJ1SUQ1cWhRZlE1NGw0T3p5a3l0UXNkeHY4VURmWnZFdi0xZjN3Um83SEJwVTRyQjVqbzQzOUg4Mm1LZ1ZCNEZ2amZuM1hTNUpJNXBEQS12M0tCZEhaQ2FUa0E?oc=5\\" target=\\"_blank\\">빅웨이브로보틱스, 코스닥 상장 첫날 210%대 급등 - 머니투데이</a> <font color=\\"#6f6f6f\\">머니투데이</font>"}, {"link": "https://news.google.com/rss/articles/CBMiY0FVX3lxTE9FRWlXSVVHUnB5ZVNJUHZKNlI1TmhLM21zTTdXejBxSVM3YkFjTURsS3lsMUhUWXFhd0JZeTFoeC1aa3FwNUxFcGxfY0ZfQS1mZHptVllmWDlkbVlrNHotdnBGYw?oc=5", "title": "[특징주] 빅웨이브로보틱스 코스닥 상장 첫날 200%대 급등", "source": "에너지경제신문", "pubDate": "Tue, 29 Sep 2026 00:16:24 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiY0FVX3lxTE9FRWlXSVVHUnB5ZVNJUHZKNlI1TmhLM21zTTdXejBxSVM3YkFjTURsS3lsMUhUWXFhd0JZeTFoeC1aa3FwNUxFcGxfY0ZfQS1mZHptVllmWDlkbVlrNHotdnBGYw?oc=5\\" target=\\"_blank\\">[특징주] 빅웨이브로보틱스 코스닥 상장 첫날 200%대 급등</a> <font color=\\"#6f6f6f\\">에너지경제신문</font>"}, {"link": "https://news.google.com/rss/articles/CBMibkFVX3lxTE9RTVRWcm5WRUExSFB5cHVFZ0Y0bUJsZUxXb0luQUI0ZFRWM3k5ZlJsZ3pINk11NmpHYjNzU2s3dmxjTXNhaGNuWS12UDI4LVl3NlRITlpNMkhzZzJSU2doNFhXcUFBTWNqdDZRT2dn?oc=5", "title": "‘빅웨이브로보틱스 상장일’ 수요예측 흥행 성공...따따상 이어갈까?", "source": "gukjenews.com", "pubDate": "Mon, 28 Sep 2026 15:09:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMibkFVX3lxTE9RTVRWcm5WRUExSFB5cHVFZ0Y0bUJsZUxXb0luQUI0ZFRWM3k5ZlJsZ3pINk11NmpHYjNzU2s3dmxjTXNhaGNuWS12UDI4LVl3NlRITlpNMkhzZzJSU2doNFhXcUFBTWNqdDZRT2dn?oc=5\\" target=\\"_blank\\">‘빅웨이브로보틱스 상장일’ 수요예측 흥행 성공...따따상 이어갈까?</a> <font color=\\"#6f6f6f\\">gukjenews.com</font>"}]	{"causes": [{"id": "cause-1", "title": "로봇·반도체 섹터 급등", "impact": "high", "summary": "로봇 부품·스마트팩토리주가 브릴스 급등에 힘입어 전반적으로 상승했고, 반도체·소부장 대규모 거래 소식이 전체 시장 분위기를 끌어올렸다.", "timeline": [{"desc": "브릴스 급등·반도체 3조4천억 거래 등 섹터 호재가 속속 등장", "title": "섹터 뉴스"}, {"desc": "외국인·기관 매수와 로봇·반도체 주식에 대한 투자 열기 확대", "title": "시장 반응"}], "conclusion": "섹터 전반이 불꽃 튀며 빅웨이브도 휘청거렸다.", "newsIndices": [0, 4, 8], "similarCase": "2024년 초 로봇 부품주가 반도체 호재에 연동돼 30% 이상 급등한 사례와 흡사", "expertOpinions": {"bearish": {"count": 0, "summary": ""}, "bullish": {"count": 0, "summary": ""}}}], "oneLiner": "빅웨이브로보틱스가 미친듯이 급등했잖아, 로봇·반도체 불꽃놀이가 터진 거다!", "aiComment": "오늘 로봇·반도체 파티가 터지면서 빅웨이브가 짜릿하게 뛰었어. 섹터 전체가 뜨거운 불꽃을 뿜으며 투자심리도 폭발했지. 근데 이 정도는 일시적일 수도 있으니, 스스로 판단하고 신중히 가자!\\n\\n이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다."}	\N	2026-10-01 04:37:17.652+00	2026-10-01 04:37:17.727542+00
1f27ee17-7554-401f-acd2-5ab78882077d	aedc96f9-b872-4a87-8719-ac72491432d9	0161M0	네오사피엔스	{"close": null, "marketCap": null, "changeRate": null}	[{"link": "https://www.investchosun.com/site/data/html_dir/2026/10/07/2026100780007.html", "title": "[Invest]반짝 살아난 공모주 상장일 강세…이후 주가는 '널뛰기'", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 08:16:00 +0900", "language": "ko", "description": "와이즈플래닛컴퍼니가 285.8%로 가장 높은 상승률을 기록했고 네오사피엔스와 스카이랩스가 각각 243%, 135% 올랐다. 글로벌테크놀로지는 82.2%, 빅웨이브로보틱스는 66.1%, 덕산넵코어스는 23.2% 상승 마감했다.7~8월 신규..."}, {"link": "http://www.metroseoul.co.kr/article/20261007500001", "title": "청약 대박이 주가 대박은 아니었다…8월 울고 9월 웃은 코스닥 새내기주", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 06:38:00 +0900", "language": "ko", "description": "7일 한국거래소에 따르면 9월 상장사 중 와이즈플래닛컴퍼니(285.8%)와 네오사피엔스(243%)는 첫날 주가가 공모가의 3배를 넘겼다. 반면 8월 상장주 6곳의 월말 수익률은 평균 -23.6%였다. 청약 흥행과는 무관했다. 8월..."}, {"link": "http://www.kjdaily.com/article.php?aid=1791288186688423276", "title": "아톤 회전율 80%·에스투더블유 61%…보안주 거래 활발", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 21:04:00 +0900", "language": "ko", "description": "네오사피엔스는 16.60%, 브릴스는 10.59% 떨어졌다. 회전율 상위 50위의 기준선은 9.96%였다. 50위 씨피시스템은 상장주식 3천643만6천605주 가운데 362만9천400주가 거래됐다. 주가는 6.27% 오른 4천405원으로 마감했다...."}, {"link": "https://www.greened.kr/news/articleView.html?idxno=351524", "title": "대형사 틈서 존재감 키운 대신증권...IPO 후속 물량 13곳 '두둑'", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 18:23:00 +0900", "language": "ko", "description": "상반기에는 한패스(209억원)와 채비(138억원) 등 2건에 그쳤지만, 3분기 들어 네오사피엔스(200억원), 와이즈플래닛컴퍼니(192억원), 덕산넵코어스(438억원) 등의 상장을 잇달아 주관하며 실적을 끌어올렸다. 상위권은..."}, {"link": "https://www.newspim.com/news/view/20261006001270", "title": "IPO 시장 4분기 '기지개'…AI·로봇 앞세워 22곳 상장 채비", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 16:47:00 +0900", "language": "ko", "description": "스카이랩스를 비롯해 네오사피엔스, 와이즈플래닛, 빅웨이브로보틱스 등 9월 상장 종목 6곳 모두 상장 첫날 공모가를 웃돌았다. 앞서 하반기 IPO 시장은 기관 수요예측과 일반청약 경쟁률이 낮아지고 상장 직후 주가..."}, {"link": "https://www.pinpointnews.co.kr/news/articleView.html?idxno=493054", "title": "[코스닥 기관] 리노공업 집중 매수…주성엔지니어링·2차전지주도 쓸어...", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 15:58:00 +0900", "language": "ko", "description": "반면 기관 순매도 상위권에는 하나마이크론, 테스, ISC, 지엔씨에너지, 알테오젠, 파마리서치, 심텍, 네오사피엔스, 삼현, 샘씨엔에스 등이 자리했다. 반도체 관련주 가운데 하나마이크론과 테스, ISC, 심텍, 샘씨엔에스..."}, {"link": "https://www.sisajournal-e.com/news/articleView.html?idxno=424132", "title": "10월 공모주 쏟아진다···'7연승'에 릴레이 청약 열풍 펼쳐지나", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 10:18:00 +0900", "language": "ko", "description": "지난달 상장한 스카이랩스, 네오사피엔스, 와이즈플래닛컴퍼니, 글로벌테크놀로지, 빅웨이브로보틱스, 덕산넵코어스 등 6곳과 지난 1일 상장한 브릴스까지 최근 신규 상장기업 7곳은 모두 상장 첫날 종가가..."}, {"link": "https://n.news.naver.com/mnews/article/015/0005339360?sid=101", "title": "첫날 285% 수익에 '화들짝'…공모주 분위기 180도 달라졌다 [분석+]", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 06:31:00 +0900", "language": "ko", "description": "6일 한국거래소에 따르면 지난달 신규 상장한 종목(스팩 제외)은 스카이랩스(상장일 9월4일), 네오사피엔스(9월21일), 와이즈플래닛컴퍼니(9월23일), 빅웨이브로보틱스(9월29일), 글로벌테크놀로지(9월29일)..."}, {"link": "https://n.news.naver.com/mnews/article/011/0004668353?sid=101", "title": "중소형 IPO 활기…삼성證, 빅3 누르고 1위 차지 [시그널]", "source": "네이버뉴스", "pubDate": "Tue, 06 Oct 2026 06:01:00 +0900", "language": "ko", "description": "대신증권은 그 외에도 네오사피엔스(200억 원)와 와이즈플래닛컴퍼니(192억 원) 상장을 도왔다. 4분기 순위 경쟁의 판도는 빅딜 주관 여부에 따라 달라질 전망이다. 공모 규모만 최대 2011억 원에 달하는 인공지능(AI)..."}, {"link": "https://news.google.com/rss/articles/CBMic0FVX3lxTFBsbGZRdUl5M2ZMbkV3UGR2MVREek9YZGpqTHBiRS1Nak0zSVZ5bEZKVFZwWHlaNG1hTHk3V1JzVHE0WElyNXU5UGp0enNhNFBtRlN0VGRuVzRkR3hINTFacUp6c19WdGVpYWdSeWd0TU9Vbkk?oc=5", "title": "네오사피엔스 투자분석 2026. 10. 05", "source": "주달", "pubDate": "Mon, 05 Oct 2026 07:17:34 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMic0FVX3lxTFBsbGZRdUl5M2ZMbkV3UGR2MVREek9YZGpqTHBiRS1Nak0zSVZ5bEZKVFZwWHlaNG1hTHk3V1JzVHE0WElyNXU5UGp0enNhNFBtRlN0VGRuVzRkR3hINTFacUp6c19WdGVpYWdSeWd0TU9Vbkk?oc=5\\" target=\\"_blank\\">네오사피엔스 투자분석 2026. 10. 05</a> <font color=\\"#6f6f6f\\">주달</font>"}, {"link": "https://www.etoday.co.kr/news/view/2632381", "title": "IPO 시장 4분기 ‘기지개’…AI 기업 공모 잇따라", "source": "네이버뉴스", "pubDate": "Mon, 05 Oct 2026 14:36:00 +0900", "language": "ko", "description": "스카이랩스와 네오사피엔스 등 지난달 상장 기업 6곳은 모두 상장일 종가가 공모가를 웃돌았다. 4분기에도 공모 일정이 늘어날 전망이다. 이달 수요예측 예정 기업은 16곳이다. 업계에서는 공모 절차를 앞두거나..."}, {"link": "https://news.google.com/rss/articles/CBMitgFBVV95cUxPdTEyU3ppRTU2dDZOOHowSGdzT1hHdVBXR1JLNjJ4eXFQMEs5NVZGbVhLMzJSYjAxMVRBVHlxdmdtblBiTzZLTHhBNk5IX0RuTjl2aktXTFFZNTBFZ1BSY0FjalltNlc4Sml5cjhreHh0WkRPZHVLVS02Q08wSjBCLWF2STBwTlN4Q3c1bzdWTGw0bjhRaHpJcHNQWmZDYjZPMUU2Zk9zLWZUZFMzQVhadFVjLXA2Zw?oc=5", "title": "슬롯 무료 사이트 규칙 페이지를 찾는 경로", "source": "Calgary Roughnecks", "pubDate": "Sun, 04 Oct 2026 22:52:49 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMitgFBVV95cUxPdTEyU3ppRTU2dDZOOHowSGdzT1hHdVBXR1JLNjJ4eXFQMEs5NVZGbVhLMzJSYjAxMVRBVHlxdmdtblBiTzZLTHhBNk5IX0RuTjl2aktXTFFZNTBFZ1BSY0FjalltNlc4Sml5cjhreHh0WkRPZHVLVS02Q08wSjBCLWF2STBwTlN4Q3c1bzdWTGw0bjhRaHpJcHNQWmZDYjZPMUU2Zk9zLWZUZFMzQVhadFVjLXA2Zw?oc=5\\" target=\\"_blank\\">슬롯 무료 사이트 규칙 페이지를 찾는 경로</a> <font color=\\"#6f6f6f\\">Calgary Roughnecks</font>"}, {"link": "https://news.google.com/rss/articles/CBMiaEFVX3lxTE9malRIYWFuMnUwUjcyOVJmSENTQVVnbmpqSzF3Vlo3QkhIZ0hyZmExRllkVm42aVhPMWZfU1lHalNaNEtVQ3lIaW9aRG84Zk56YVRyZHhYS2dsTG5rb1htcjBnUmxEN3k30gFuQVVfeXFMTUI2M0dhbGgzMEpnQ0FhajBEcTZTTUJpUlNxOTdncmtOQ0docjlLT09Pdnotb3dBNVRTN0tHdGF3OVhsQUR2c2JHdFowdHZ5bGk0cU94TUxHWnpJMVFBSXBfajlXVHdYSlBRVzJfY3c?oc=5", "title": "[종목상담소 주식민원처리반 1부] '에스앤에스텍 vs 네오사피엔스' ... 다음주 승자는? - 머니투데이", "source": "머니투데이", "pubDate": "Fri, 02 Oct 2026 13:41:57 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiaEFVX3lxTE9malRIYWFuMnUwUjcyOVJmSENTQVVnbmpqSzF3Vlo3QkhIZ0hyZmExRllkVm42aVhPMWZfU1lHalNaNEtVQ3lIaW9aRG84Zk56YVRyZHhYS2dsTG5rb1htcjBnUmxEN3k30gFuQVVfeXFMTUI2M0dhbGgzMEpnQ0FhajBEcTZTTUJpUlNxOTdncmtOQ0docjlLT09Pdnotb3dBNVRTN0tHdGF3OVhsQUR2c2JHdFowdHZ5bGk0cU94TUxHWnpJMVFBSXBfajlXVHdYSlBRVzJfY3c?oc=5\\" target=\\"_blank\\">[종목상담소 주식민원처리반 1부] '에스앤에스텍 vs 네오사피엔스' ... 다음주 승자는? - 머니투데이</a> <font color=\\"#6f6f6f\\">머니투데이</font>"}, {"link": "https://news.google.com/rss/articles/CBMiVEFVX3lxTFBiZHdNXzc3Q083QUlLMWJHT1Z0U2Y4SmVoaFlPQWxBYjhmbS1OWGZoNlZTSzFEZXRMTHVEOFJwSHZuX0RsVXN5Z3hublJuRzFZZ01QNw?oc=5", "title": "[종목상담소 주식민원처리반 1부] '에스앤에스텍 vs 네오사피엔스' ... 다음주 승자는?", "source": "Daum", "pubDate": "Fri, 02 Oct 2026 13:38:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiVEFVX3lxTFBiZHdNXzc3Q083QUlLMWJHT1Z0U2Y4SmVoaFlPQWxBYjhmbS1OWGZoNlZTSzFEZXRMTHVEOFJwSHZuX0RsVXN5Z3hublJuRzFZZ01QNw?oc=5\\" target=\\"_blank\\">[종목상담소 주식민원처리반 1부] '에스앤에스텍 vs 네오사피엔스' ... 다음주 승자는?</a> <font color=\\"#6f6f6f\\">Daum</font>"}, {"link": "https://news.google.com/rss/articles/CBMiiAFBVV95cUxPSWQtWDRyLU1OZEZCSFdLcUlkZnpCWU04REJWa192QkxMN2x3MnNzQlYyQjRPSHFyREJ1NGo2VXRTZDB4aE9PVzFuMGp6RHpwb0FXWnBGUWdLM1Q5d2VKMS1LZGd0Z01RY0IwSF91TzZ0YUxfYVBndVRQMHpXTHQ4ZkVPUVJGVFRI0gGcAUFVX3lxTE85bHZmRUlKSVZRUDRBSGdYY0VtSG14Ti1YS25hVENWNGhPUWNqS2Y3Y0RZUG5oeVpsQ0RRWFVRdHB1YWtPcFItWElIR041cW9EcEZqdmJkNFZHVWZDRFJQMjVuZm5hY0FzV2xlWmVOaGdCeDR1dWxNbDJmSlprTzlmalF3c1M4Q19rSTg4ZkRlU1Ayd3l0UFotWVZLaw?oc=5", "title": "[특징주] 네오사피엔스, 상장 첫날 불기둥…장중 200%↑ - 조선비즈", "source": "Chosunbiz", "pubDate": "Mon, 21 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiiAFBVV95cUxPSWQtWDRyLU1OZEZCSFdLcUlkZnpCWU04REJWa192QkxMN2x3MnNzQlYyQjRPSHFyREJ1NGo2VXRTZDB4aE9PVzFuMGp6RHpwb0FXWnBGUWdLM1Q5d2VKMS1LZGd0Z01RY0IwSF91TzZ0YUxfYVBndVRQMHpXTHQ4ZkVPUVJGVFRI0gGcAUFVX3lxTE85bHZmRUlKSVZRUDRBSGdYY0VtSG14Ti1YS25hVENWNGhPUWNqS2Y3Y0RZUG5oeVpsQ0RRWFVRdHB1YWtPcFItWElIR041cW9EcEZqdmJkNFZHVWZDRFJQMjVuZm5hY0FzV2xlWmVOaGdCeDR1dWxNbDJmSlprTzlmalF3c1M4Q19rSTg4ZkRlU1Ayd3l0UFotWVZLaw?oc=5\\" target=\\"_blank\\">[특징주] 네오사피엔스, 상장 첫날 불기둥…장중 200%↑ - 조선비즈</a> <font color=\\"#6f6f6f\\">Chosunbiz</font>"}, {"link": "https://news.google.com/rss/articles/CBMiW0FVX3lxTE9wcHdlSkptaFFtMHVwZkcxb1M3bDQwUnczdm9Vd2xCcDdjUVM0UUU4cFdab2NWZzV1dDZJellqQmlORTE0S0ttZlc1anYtZXdBVEFTS1JRekh1MDDSAWBBVV95cUxNVjdMbndPaU51Ym96U21BSUlmdmdvazY5TThMTFB2SEFzdTNQbWdHRTR0dHlVdVZkNlN4a3NsWVBNOU02T0RqampnS2J5aG5kc1JPWDEwLUhOUHhlMXlaZE4?oc=5", "title": "[특징주] 네오사피엔스, 코스닥 상장 첫날 243% 급등(종합)", "source": "연합뉴스", "pubDate": "Mon, 21 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiW0FVX3lxTE9wcHdlSkptaFFtMHVwZkcxb1M3bDQwUnczdm9Vd2xCcDdjUVM0UUU4cFdab2NWZzV1dDZJellqQmlORTE0S0ttZlc1anYtZXdBVEFTS1JRekh1MDDSAWBBVV95cUxNVjdMbndPaU51Ym96U21BSUlmdmdvazY5TThMTFB2SEFzdTNQbWdHRTR0dHlVdVZkNlN4a3NsWVBNOU02T0RqampnS2J5aG5kc1JPWDEwLUhOUHhlMXlaZE4?oc=5\\" target=\\"_blank\\">[특징주] 네오사피엔스, 코스닥 상장 첫날 243% 급등(종합)</a> <font color=\\"#6f6f6f\\">연합뉴스</font>"}, {"link": "https://news.google.com/rss/articles/CBMiXEFVX3lxTE9XV0s1TVFMcUFlbGdKY1lWaVNlTmlJeXdZMUs1LXRoVm94V0cyN1IzbkE3WjVyOGd1ZllmZW9ucEpRVHVud2RSMC0tXzBUU2RfNVh3cjRzX19kc3BF?oc=5", "title": "[특징주] 네오사피엔스, 상장 첫날 공모가 대비 260%↑", "source": "뉴스핌", "pubDate": "Mon, 21 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiXEFVX3lxTE9XV0s1TVFMcUFlbGdKY1lWaVNlTmlJeXdZMUs1LXRoVm94V0cyN1IzbkE3WjVyOGd1ZllmZW9ucEpRVHVud2RSMC0tXzBUU2RfNVh3cjRzX19kc3BF?oc=5\\" target=\\"_blank\\">[특징주] 네오사피엔스, 상장 첫날 공모가 대비 260%↑</a> <font color=\\"#6f6f6f\\">뉴스핌</font>"}]	{"causes": [], "oneLiner": "네오사피엔스, 오늘은 딱히 폭풍도 안 치고 파도도 안 친다, 그냥 물가에 떠 있는 중…", "aiComment": "요즘 IPO 뜨거워서 눈길은 끊이지 않지만, 네오사피엔스는 아직도 무대 뒤에서 연습 중이라며 관중석에서 조용히 응원해보자. 투자 판단은 스스로, 오늘도 파이팅!\\n\\n이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다."}	\N	2026-10-07 02:03:45.924+00	2026-10-07 02:03:46.06472+00
5ea72221-4eb6-49c6-a953-c366b10e0ea9	aedc96f9-b872-4a87-8719-ac72491432d9	005930	삼성전자	{"close": 268500, "marketCap": 1569725806248000, "changeRate": -1.29}	[{"link": "http://www.epj.co.kr/news/articleView.html?idxno=39549", "title": "유니슨, K-GX 참여··· 국산 풍력터빈 생태계 구축", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:48:00 +0900", "language": "ko", "description": "행사에는 정부 관계자와 경제단체, 전문가를 비롯해 국가대표 10대 녹색산업 육성 기업으로 선정된 한화큐셀, 포스코홀딩스, LG전자, 삼성전자, SK하이닉스, 유니슨 등이 참석했다. 해상풍력 분야 2조8,500억원 민간투자..."}, {"link": "https://n.news.naver.com/mnews/article/031/0001064470?sid=105", "title": "램리서치 팀 아처 CEO \\"韓 반도체 협력 더 강화\\"…전용펀드 출범", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "삼성전자와 SK하이닉스 등 국내 주요 반도체 업체에 관련 장비를 공급하고 있다. 반도체 제조는 반도체 원판인 웨이퍼에 미세한 회로를 찍고(노광), 얇은 박막을 입히고(증착), 불필요한 부분을 깎고(식각), 씻어내는..."}, {"link": "https://www.g-enews.com/view.php?ud=202610081142429437153ddfb15a_1", "title": "이억원 “레버리지 ETF 도입, 靑 지시 없어…필요성 꾸준히 제기”", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "단일종목 레버리지 ETF는 삼성전자나 SK하이닉스 등 개별 종목의 주가 움직임을 일정 배율로 추종하는 상품이다. 높은 수익을 기대할 수 있는 만큼 가격 변동에 따른 손실 위험도 커 투자자 보호를 둘러싼 논란이 이어지고..."}, {"link": "http://www.intn.co.kr/news/articleView.html?idxno=2053902", "title": "삼성전자, 3분기 영업익 107조4천억…국내 기업 최초 '100조 시대' 열어", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "삼성전자가 올해 3분기 107조4천억원의 영업이익을 기록하며 국내 기업 사상 처음으로 분기 영업이익 100조원 시대를 열었다. 글로벌 빅테크 가운데서도 분기 영업이익 100조원을 넘어선 것은 삼성전자가 처음이다...."}, {"link": "https://www.ccreview.co.kr/news/articleView.html?idxno=359417", "title": "\\"꿈을 반도체로 설계하다\\"…충북반도체고 입학설명회에 1800명 몰렸다", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "삼성전자·SK하이닉스 등 120여 기업 협력…취업률 95% 이상 충북반도체고는 반도체 산업현장에서 요구하는 전문기술 인재 양성을 목표로 실무 중심 교육과 산학협력 프로그램을 운영하고 있다. 학교에 따르면..."}, {"link": "http://www.ddanzi.com/896346502", "title": "만공스승 주식리딩 8강 : 7월의 폭락장, 원인과 전망", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "아시다시피 올해 시장 상승은 반도체 가격 상승을 기반으로 삼성전자, SK하이닉스와 삼성전기가 주도했습니다. 수익 지속성을 의심받자, 이 세 기업의 주가가 부러졌습니다. ©세계일보 자동차를 타고 달려갈 때는 혼자..."}, {"link": "https://www.the-pr.co.kr/news/articleView.html?idxno=62843", "title": "삼성전자, 3분기 영업익 107조4000억원…韓 기업 최초 '100조 돌파'", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:46:00 +0900", "language": "ko", "description": "더피알=최진 기자｜삼성전자가 올해 3분기 국내 기업 역사상 처음으로 분기 영업이익 100조원을 돌파했다. 삼성전자는 연결 기준 올해 3분기 매출 195조원, 영업이익 107조4000억원의 잠정실적을 기록했다고 8일..."}, {"link": "https://n.news.naver.com/mnews/article/015/0005340506?sid=105", "title": "갤럭시·구글 픽셀도 뚫리는 해킹 구멍, 서울대 연구진이 발견했다", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:43:00 +0900", "language": "ko", "description": "이는 전 세계 서버와 컴퓨터에 널리 사용되는 리눅스 운영체제뿐 아니라 삼성전자 갤럭시와 구글 픽셀 등 최신 안드로이드 스마트폰에도 영향을 줄 수 있는 것으로 나타났다. 연구진은 실제 공격을 통해 관리자 권한을..."}, {"link": "https://www.newsway.co.kr/news/view?ud=2026100808435645495", "title": "'메모리 슈퍼사이클' 삼성전자, 주주환원 체급도 110조→600조", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:42:00 +0900", "language": "ko", "description": "삼성전자가 메모리 반도체 슈퍼사이클(대호황)에 힘입어 분기 영업이익 100조원 시대를 열면서 주주환원도 새로운 국면에 들어섰다. 올해 주주환원 규모가 최대 110조원에 달할 것으로 예상되는 가운데 메모리 호황이..."}, {"link": "https://bizhankook.com/articles/samsung-tops-100trillion-hbm4-growth.html", "title": "삼성전자, 분기 영업익 100조 시대 열었다 \\"HBM4·범용 D램 쌍끌이 효과...", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 11:42:00 +0900", "language": "ko", "description": "삼성전자가 인공지능(AI)용 메모리 반도체 수요 확대와 가격 상승에 힘입어 분기 영업이익 100조 원 시대를 열었다. AI 데이터센터 투자 확대가 HBM(고대역폭메모리)뿐 아니라 범용 D램과 낸드 수요까지 끌어올리면서..."}, {"link": "https://news.google.com/rss/articles/CBMiW0FVX3lxTFBITm5xNVZUQlAzYm5pdkpBNkxGV2NDWG9JSWN3X2JmNXI2N3lFdm52YnNOaDlKMWxIY19qMm5Kamk3QlZoYVdLQXdzbW1UT0lobHhuY3hLWUZIanc?oc=5", "title": "분기 100조 영업익 삼성전자, 성과급은 얼마나?…“연봉 8천만원에 7.5억”", "source": "KBS 뉴스", "pubDate": "Thu, 08 Oct 2026 01:48:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiW0FVX3lxTFBITm5xNVZUQlAzYm5pdkpBNkxGV2NDWG9JSWN3X2JmNXI2N3lFdm52YnNOaDlKMWxIY19qMm5Kamk3QlZoYVdLQXdzbW1UT0lobHhuY3hLWUZIanc?oc=5\\" target=\\"_blank\\">분기 100조 영업익 삼성전자, 성과급은 얼마나?…“연봉 8천만원에 7.5억”</a> <font color=\\"#6f6f6f\\">KBS 뉴스</font>"}, {"link": "https://view.asiae.co.kr/article/2026100810173036451", "title": "107조원 벌었지만 삼성전자 주가는 주춤…'반도체 고점' 경계감 여전", "source": "아시아경제", "pubDate": "Thu, 08 Oct 2026 10:23:33 +0900", "language": "ko", "description": "삼성전자가 시장 예상치를 상회하는 사상 최대 3분기 영업이익을 발표했지만 차익실현 물량이 나오면서 주가는 약세다. 메모리 반도체 가격 상승세 둔화 가능성, 미국 국채금리 급등 부담 등이 겹치면서 코스피도 하락했다.삼성전자 최대 실적에도…차익실현, 반도체 가격 상승률 둔화 등에 주가 약세8일 코스피는 전 거래일 대비 0.07% 오른 6808.68에 개장한 뒤 하락 반전해 오전 10시3분 기준 0.82% 하락한 6747.97에 거래 중이다. 코스닥은 0.03% 내린 898.19에 장을 시작한 뒤 상승 반전해 0.20% 오른 900.1"}, {"link": "https://news.google.com/rss/articles/CBMiXkFVX3lxTFA5SEhZdVZTMTVwZllVV25LMXBiUkdLdDJhaExKWmxPZTFpbDY4UjVBRjU0WEJ0Yzc4blJ6Z3VzeXExV0JkZ05tZFBTSUs1UUI0VkhuSTdXeV9TdHI0M3c?oc=5", "title": "삼성전자 실적 발표에도 코스피·코스닥 혼조세", "source": "YTN", "pubDate": "Thu, 08 Oct 2026 00:49:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiXkFVX3lxTFA5SEhZdVZTMTVwZllVV25LMXBiUkdLdDJhaExKWmxPZTFpbDY4UjVBRjU0WEJ0Yzc4blJ6Z3VzeXExV0JkZ05tZFBTSUs1UUI0VkhuSTdXeV9TdHI0M3c?oc=5\\" target=\\"_blank\\">삼성전자 실적 발표에도 코스피·코스닥 혼조세</a> <font color=\\"#6f6f6f\\">YTN</font>"}, {"link": "https://view.asiae.co.kr/article/2026100809435539676", "title": "[포토] 삼성전자 영업익 첫 100조 돌파, 주가는 하락", "source": "아시아경제", "pubDate": "Thu, 08 Oct 2026 09:43:56 +0900", "language": "ko", "description": "삼성전자가 분기 영업익 107.4조원을 달성, 세계 테크기업 첫 100조를 돌파했지만 주가는 하락한 8일 서울 중구 하나은행 본점 딜링룸에 코스피와 삼성전자 주가가 표시되어 있다. 이날 코스피는 상승 출발했지만, 곧 하락하며 6,700선에서 움직이고 삼성전자도 상승 출발, 하락하며 267,000원대에서 등락하고 있다."}, {"link": "https://view.asiae.co.kr/article/2026100809430328081", "title": "[포토] 주가 하락 막지 못한 삼성전자 100조 돌파", "source": "아시아경제", "pubDate": "Thu, 08 Oct 2026 09:43:03 +0900", "language": "ko", "description": "삼성전자가 분기 영업익 107.4조원을 달성, 세계 테크기업 첫 100조를 돌파했지만 주가는 하락한 8일 서울 중구 하나은행 본점 딜링룸에 코스피와 삼성전자 주가가 표시되어 있다. 이날 코스피는 상승 출발했지만, 곧 하락하며 6,700선에서 움직이고 삼성전자도 상승 출발, 하락하며 267,000원대에서 등락하고 있다."}, {"link": "https://news.google.com/rss/articles/CBMiaEFVX3lxTE5FZU05R1MwTWpSVXhjU1lDeFpUVVY3aUdaLXBqQ0RkekI5RmV1SlJ4a2ZJa2JKR0Y4dl9oZ2Izd0JmWTE2VkZtc0JZOEM3TkJPR1V4blc0NVZjbXM1TUJyN3dYeXFGWEYt0gFuQVVfeXFMTUVQZWNTekM1TzB2TjdSQzl1cE9FOG9hWXMyTHFJX0UtNW9LQzBQbE13d1dIcjFyVUR3SjZuNlZmaXN0Smpqc2JZRFRSbHZRQlg2bE9FblFqX0pfUVk0bDhLVjJLUjd4MWVTdnZvN0E?oc=5", "title": "\\"삼전 영업익 100조, 주가는 왜 이래\\"...외인 또 던진다 - 머니투데이", "source": "머니투데이", "pubDate": "Thu, 08 Oct 2026 00:33:56 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiaEFVX3lxTE5FZU05R1MwTWpSVXhjU1lDeFpUVVY3aUdaLXBqQ0RkekI5RmV1SlJ4a2ZJa2JKR0Y4dl9oZ2Izd0JmWTE2VkZtc0JZOEM3TkJPR1V4blc0NVZjbXM1TUJyN3dYeXFGWEYt0gFuQVVfeXFMTUVQZWNTekM1TzB2TjdSQzl1cE9FOG9hWXMyTHFJX0UtNW9LQzBQbE13d1dIcjFyVUR3SjZuNlZmaXN0Smpqc2JZRFRSbHZRQlg2bE9FblFqX0pfUVk0bDhLVjJLUjd4MWVTdnZvN0E?oc=5\\" target=\\"_blank\\">\\"삼전 영업익 100조, 주가는 왜 이래\\"...외인 또 던진다 - 머니투데이</a> <font color=\\"#6f6f6f\\">머니투데이</font>"}, {"link": "https://news.google.com/rss/articles/CBMidEFVX3lxTE9Cb3ZfUXFMcVd1SDZiSFFrU1Z1b3BxOExWMTdsQlhSbXd5Tktva2xWRk1fbS1RR2lPb0M4YWFHQXNsY2NVYVRiajV4cXlkUmN0Vm1aNndrdW1GdDg5QkpTWTFEc1ZuNVpHVnQwSnpwLUdRTUVN0gF0QVVfeXFMTlduTC04SEpNNVBtMUpCNVR1em1OVDFXT2tKeE4tR0I1RjkwMjU5aldieFIzeThaVzV0LWRjOGppS21Rd1FMZDRUc1BfU0lWaldUSkJvd1ZPbU5KbGNiVVZubDVfUDR3N2kycXRKLWJvV3lUbng?oc=5", "title": "[속보] 삼성전자 3분기 영업이익 107조4천억 원‥4분기 연속 신기록", "source": "MBC 뉴스", "pubDate": "Wed, 07 Oct 2026 23:31:42 GMT", "language": "ko", "description": "<ol><li><a href=\\"https://news.google.com/rss/articles/CBMidEFVX3lxTE9Cb3ZfUXFMcVd1SDZiSFFrU1Z1b3BxOExWMTdsQlhSbXd5Tktva2xWRk1fbS1RR2lPb0M4YWFHQXNsY2NVYVRiajV4cXlkUmN0Vm1aNndrdW1GdDg5QkpTWTFEc1ZuNVpHVnQwSnpwLUdRTUVN0gF0QVVfeXFMTlduTC04SEpNNVBtMUpCNVR1em1OVDFXT2tKeE4tR0I1RjkwMjU5aldieFIzeThaVzV0LWRjOGppS21Rd1FMZDRUc1BfU0lWaldUSkJvd1ZPbU5KbGNiVVZubDVfUDR3N2kycXRKLWJvV3lUbng?oc=5\\" target=\\"_blank\\">[속보] 삼성전자 3분기 영업이익 107조4천억 원‥4분기 연속 신기록</a> <font color=\\"#6f6f6f\\">MBC 뉴스</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiW0FVX3lxTE1zWlVRU0VJVVh4M1BGZ1RCbGRjSHdTNGhtTEVlVFBIeDJSdVIwWjZEblpraDZMOGJHQjNzVmptdWlaVVNmNGt4V0xlU0ZWUnRNZDlfUnAwX01XU0XSAWBBVV95cUxOWmNETEN5QXdoWENjOFh1eEYteE9NbTRoVDVxeUVrN1RxOC1DODZtXzEyTGVRWG81TU1oTmpKNXZkUXhMLUNpNFFEUWNtYVlDUG82SlVoWUtkQVoteURIcFk?oc=5\\" target=\\"_blank\\">[1보] 삼성전자 3분기 영업이익 107조4천억원…작년 대비 782.5%↑</a> <font color=\\"#6f6f6f\\">연합뉴스</font></li><li><a href=\\"https://news.google.com/rss/articles/CBMiVEFVX3lxTE9wQTNKLTJPdTA2d052ZFBBN3gxazZld1VSWlhaeU9MQmlaN05uY2pRSG1aQ0dDMDlpNndfSlRNeHR4RVZFcjRDV3U3TGx3M1Nva3pYeA?oc=5\\" target=\\"_blank\\">엔비디아도 못 한 걸 삼성전자가…3분기 영업익 ‘100조 돌파’</a> <font color=\\"#6f6f6f\\">JTBC</font></li></ol>"}, {"link": "https://news.google.com/rss/articles/CBMiYEFVX3lxTE5OLThabzBHVVhJRE5rX2R0TDFxYk9lNUJtZ0daSGhmRmEyMVctZ3E4YWt0WTBvTmIyTHp3bnBOWHVmcEFqaGpXcXE4WG1HMnpRZ2JCZUVEdFJfVDkxbEJoWA?oc=5", "title": "[굿모닝증시]美 금리 부담에 약보합…삼성전자 실적에 촉각", "source": "아시아경제", "pubDate": "Wed, 07 Oct 2026 23:06:11 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiYEFVX3lxTE5OLThabzBHVVhJRE5rX2R0TDFxYk9lNUJtZ0daSGhmRmEyMVctZ3E4YWt0WTBvTmIyTHp3bnBOWHVmcEFqaGpXcXE4WG1HMnpRZ2JCZUVEdFJfVDkxbEJoWA?oc=5\\" target=\\"_blank\\">[굿모닝증시]美 금리 부담에 약보합…삼성전자 실적에 촉각</a> <font color=\\"#6f6f6f\\">아시아경제</font>"}]	{"causes": [{"id": "cause-1", "title": "3분기 초고액 영업이익 발표", "impact": "high", "summary": "삼성전자가 3분기 영업이익 107조4천억 원을 기록, 국내 기업 최초 100조 시대 개막. 투자자들은 기대감에 매수했지만, 이미 가격에 반영돼 급등 대신 소폭 조정.", "timeline": [{"desc": "3분기 영업이익 107조4천억 원 발표", "title": "실적 발표"}], "conclusion": "초고액 이익에도 불구하고 이미 반영돼서 주가가 살짝 내려갔음.", "newsIndices": [3], "similarCase": "", "expertOpinions": {"bearish": {"count": 0, "summary": ""}, "bullish": {"count": 0, "summary": ""}}}], "oneLiner": "삼성전자 주가가 살짝 툭 내려갔지만, 이거 완전 ‘시험점수 올랐는데 선생님이 숙제 줬다’ 수준이라니까!", "aiComment": "뭐, 이번엔 실적이 짱짱했지만 이미 다 반영돼서 살짝 툭 떨어진 거야. 마치 시험 만점 받고 교과서에 별표 찍히는 느낌! 급등도 아니고, 급락도 아니고, 그냥 '에이 뭐 볼 거 있냐' 하는 수준이라니까. 조심히 지켜보자!\\n\\n이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다."}	\N	2026-10-08 02:51:21.305+00	2026-10-08 02:51:21.450078+00
9072ad1d-215a-4f82-83a1-9291419ffe4b	aedc96f9-b872-4a87-8719-ac72491432d9	379810	KODEX 미국나스닥100	{"close": 27710, "marketCap": 10165413500000, "changeRate": 0.02}	[{"link": "https://n.news.naver.com/mnews/article/011/0004669351?sid=101", "title": "“증시 올랐는데 수익률 마이너스?” 환율 변동에 ‘헤지 vs 노출’ 희비", "source": "네이버뉴스", "pubDate": "Thu, 08 Oct 2026 10:01:00 +0900", "language": "ko", "description": "국내 투자자의 미국 주식 보관액은 10월 5일 기준 2002억 달러를 재돌파했고, 최근 한 달간 TIGER 미국S&P500·KODEX 미국나스닥100 등 세 상품에만 1조 6135억 원이 순유입됐다. 미래에셋자산운용은 단기적으로 원·달러..."}, {"link": "https://n.news.naver.com/mnews/article/011/0004669199?sid=101", "title": "수익률 13%P 갈렸다…환헤지에 울고 웃은 서학개미", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 20:22:00 +0900", "language": "ko", "description": "최근 한 달간 ‘TIGER 미국S&P500’에는 6440억 원, ‘KODEX 미국나스닥100’에는 6039억 원, ‘KODEX 미국S&P500’에는 3656억 원이 순유입됐다. 세 상품에만 1조 6135억 원이 몰렸다. 이경준 키움투자자산운용 ETF본부장은..."}, {"link": "https://www.ebn.co.kr/news/articleView.html?idxno=1727034", "title": "[운용 & Now] 삼성운용, 연금투자 가이드북 'ETF 연금술사' 발간 등", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 17:42:00 +0900", "language": "ko", "description": "가이드북에는 대표지수·AI·월배당·자산배분·채권·원자재 등 6개 유형의 KODEX ETF 22종도 수록됐다.... 한국거래소에 따르면 연초 이후 개인 순매수는 'TIGER 미국나스닥100타겟데일리커버드콜' 8286억원, 'TIGER 미국S..."}, {"link": "http://www.wikileaks-kr.org/news/articleView.html?idxno=192934", "title": "[운용 NOW] 삼성자산운용·미래에셋자산운용·한국투자신탁운용·한화자...", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 17:40:00 +0900", "language": "ko", "description": "이를 맞아 이날 오후 6시에는 KODEX(코덱스) 공식 유튜브 채널을 통해 가이드북 발간 기념 라이브... 한국거래소에 따르면 'TIGER 미국나스닥100타겟데일리커버드콜'의 연초 이후 개인 순매수는 8286억원, 'TIGER 미국S..."}, {"link": "https://theviewers.co.kr/View.aspx?No=4255198", "title": "'탈국장' 선명해진 ETF…개인도, 운용사도 '해외로'", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 16:24:00 +0900", "language": "ko", "description": "순매수 1~3위는 'TIGER 미국SP500'(4543억원), 'KODEX 미국SP500'(2492억원), 'KODEX 미국나스닥100'(2486억원) 등 미국 대표지수 ETF가 나란히 차지했다. 국내투자형 ETF도 순매수 상위권에 이름을 올렸지만 'TIGER..."}, {"link": "https://www.newspim.com/news/view/20261007001274", "title": "[ETF 시황] 코스피 하락에 인버스 '상승'…반도체·방산 '동반 약세'", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 16:02:00 +0900", "language": "ko", "description": "이어 KODEX 단기채권(4135억원), KODEX 레버리지(3145억원), KODEX 미국나스닥100(2517억원), TIGER 200(1766억원) 순으로 자금이 들어왔다. 반면 순유출 상위에는 레버리지와 반도체 ETF가 포진했다. KODEX..."}, {"link": "http://www.choicenews.co.kr/news/articleView.html?idxno=172008", "title": "미래에셋자산운용, 미국 커버드콜 ETF 개인 순매수 1조 돌파...의미는?", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 15:40:00 +0900", "language": "ko", "description": "상품별로는 'TIGER 미국나스닥100타겟데일리커버드콜'의 개인 누적 순매수액이 8286억원으로 가장 컸다. 이어... 삼성자산운용은 'KODEX 미국배당커버드콜액티브'를 통해 미국 배당성장주에 투자하면서 개별 종목의..."}, {"link": "http://www.hansbiz.co.kr/news/articleView.html?idxno=870799", "title": "[마켓H] 미국은 AI 랠리인데 한국은 뒷걸음질…코스피 6800선 추락", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 15:38:00 +0900", "language": "ko", "description": "ETF CHECK에 따르면 최근 일주일간 'KODEX 미국나스닥100'에 2517억원, 'TIGER 미국S&P500'에 1612억원이 순유입됐다. 시장은 오는 8일 발표되는 삼성전자 3분기 잠정실적을 반등의 분수령으로 보고 있다. 실적 호조..."}, {"link": "http://www.thevaluenews.co.kr/news/view.php?idx=202170", "title": "[위클리 ETF] 10月 1주차, ‘TIGER 코스닥150 레버리지’ 수익률 톱 15.72...", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 15:10:00 +0900", "language": "ko", "description": "TIGER 미국S&P500은 4조5488억원, KODEX 미국나스닥100은 3조8642억원, KODEX 미국S&P500은 3조5610억원 거래됐다. KODEX 인버스는 2조9427억원의 거래대금을 기록했다. 이번 주 수익률 상위권을 차지한 코스닥 상품의..."}, {"link": "https://n.news.naver.com/mnews/article/088/0001032752?sid=101", "title": "[여의도단신]삼성자산운용·미래에셋자산운용·한국투자신탁운용·한화...", "source": "네이버뉴스", "pubDate": "Wed, 07 Oct 2026 11:00:00 +0900", "language": "ko", "description": "이와 함께 오늘 오후 6시에는 KODEX 공식 유튜브 채널을 통해 가이드북 발간 기념 라이브 웹세미나를... 한국거래소에 따르면 'TIGER 미국나스닥100타겟데일리커버드콜'의 연초 이후 개인 순매수는 8286억 원, 'TIGER..."}, {"link": "https://news.google.com/rss/articles/CBMiUkFVX3lxTFBkTzRlSUNMWkNuWFp4bTRxd1JJVXM0WUFsNWdaSkthNE9xUDVYZnFXY2pIdFBCVmJwYnI5YUVMaWczOWZQeTM0akNQcGdCeURsemfSAVNBVV95cUxNaFpyNmtpVkd5REhVTDVKcGs3M29qazBVbW83S3hVN01oV3BRNV9SOTZkQTdmbktqUVpJUUdUdUQ3bEg1OXVtT3RXTHR6TWdCRzVpYw?oc=5", "title": "“돈은 미장·파킹형 갔는데”… 수익은 코스닥 ‘소부장’서 터졌다 [선데이 머니카페]", "source": "서울경제", "pubDate": "Sat, 03 Oct 2026 22:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiUkFVX3lxTFBkTzRlSUNMWkNuWFp4bTRxd1JJVXM0WUFsNWdaSkthNE9xUDVYZnFXY2pIdFBCVmJwYnI5YUVMaWczOWZQeTM0akNQcGdCeURsemfSAVNBVV95cUxNaFpyNmtpVkd5REhVTDVKcGs3M29qazBVbW83S3hVN01oV3BRNV9SOTZkQTdmbktqUVpJUUdUdUQ3bEg1OXVtT3RXTHR6TWdCRzVpYw?oc=5\\" target=\\"_blank\\">“돈은 미장·파킹형 갔는데”… 수익은 코스닥 ‘소부장’서 터졌다 [선데이 머니카페]</a> <font color=\\"#6f6f6f\\">서울경제</font>"}, {"link": "https://news.google.com/rss/articles/CBMiakFVX3lxTE12YzR6OHo0bG9uQkNPY0VtQXNaZWYxeDRYZUVIOWxNT1RsT0tlMjZrSHA2clZFYlVpSF9GNXptanpSQVhpc1ZTZ01qYTZvOWpvRmhLOFc3Z1E5X1ZBbG9WQV9Hb1Q1eHV2Ymc?oc=5", "title": "[월간 ETF워치]레버리지 팔고 미국으로…개미, S&P500 담았다", "source": "비즈워치", "pubDate": "Sat, 03 Oct 2026 00:00:03 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiakFVX3lxTE12YzR6OHo0bG9uQkNPY0VtQXNaZWYxeDRYZUVIOWxNT1RsT0tlMjZrSHA2clZFYlVpSF9GNXptanpSQVhpc1ZTZ01qYTZvOWpvRmhLOFc3Z1E5X1ZBbG9WQV9Hb1Q1eHV2Ymc?oc=5\\" target=\\"_blank\\">[월간 ETF워치]레버리지 팔고 미국으로…개미, S&P500 담았다</a> <font color=\\"#6f6f6f\\">비즈워치</font>"}, {"link": "https://news.google.com/rss/articles/CBMiS0FVX3lxTE51UEVFWGdiczNOdmFCLXBwQ1ZVbWFxeEdqNXYzTXpmM0w2eXR0ZU5jMG41TlI0akZDa2RJMktXcUdJclAwX1N1bnJiaw?oc=5", "title": "최우수 ETF(해외) ‘KODEX 미국나스닥100’ 순자산 10조…시장 리드[2026 헤럴드 투자대상 최우수 ETF(해외)-삼성자산운용]", "source": "Daum", "pubDate": "Thu, 01 Oct 2026 02:47:45 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiS0FVX3lxTE51UEVFWGdiczNOdmFCLXBwQ1ZVbWFxeEdqNXYzTXpmM0w2eXR0ZU5jMG41TlI0akZDa2RJMktXcUdJclAwX1N1bnJiaw?oc=5\\" target=\\"_blank\\">최우수 ETF(해외) ‘KODEX 미국나스닥100’ 순자산 10조…시장 리드[2026 헤럴드 투자대상 최우수 ETF(해외)-삼성자산운용]</a> <font color=\\"#6f6f6f\\">Daum</font>"}, {"link": "https://news.google.com/rss/articles/CBMickFVX3lxTE5WMnl2ck9zQ2JxSFJKN2xwQVp4NDB4bGV0SWx3WG9MR3h1eklfbXFzazhCVHRXVlBjM1NUQlpqNE1Nb0p1UzZVcExPWm42N2ZqYWpCS1dhb3ROOUtoTmQwSC16VDRyb1NUUHJsQ3pLVmJzZw?oc=5", "title": "삼성운용 KODEX 미국나스닥100데일리커버드콜OTM, 순자산 1조원 돌파", "source": "인더스트리뉴스", "pubDate": "Wed, 02 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMickFVX3lxTE5WMnl2ck9zQ2JxSFJKN2xwQVp4NDB4bGV0SWx3WG9MR3h1eklfbXFzazhCVHRXVlBjM1NUQlpqNE1Nb0p1UzZVcExPWm42N2ZqYWpCS1dhb3ROOUtoTmQwSC16VDRyb1NUUHJsQ3pLVmJzZw?oc=5\\" target=\\"_blank\\">삼성운용 KODEX 미국나스닥100데일리커버드콜OTM, 순자산 1조원 돌파</a> <font color=\\"#6f6f6f\\">인더스트리뉴스</font>"}, {"link": "https://news.google.com/rss/articles/CBMiYEFVX3lxTE1uOFhtQ2RYQmlpblc0WkJScEVxbXJGNmZHYjFneHBMaUhCVlUyTVp1c1JKdm9FVnBrdURWTTFjTnBLWUpFUzhncS0zMU5XZGF1TlJfRzc4dzdQNHFOSXdqdw?oc=5", "title": "'KODEX 미국나스닥100데일리커버드콜OTM', 순자산 1조원 돌파", "source": "아시아경제", "pubDate": "Wed, 02 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiYEFVX3lxTE1uOFhtQ2RYQmlpblc0WkJScEVxbXJGNmZHYjFneHBMaUhCVlUyTVp1c1JKdm9FVnBrdURWTTFjTnBLWUpFUzhncS0zMU5XZGF1TlJfRzc4dzdQNHFOSXdqdw?oc=5\\" target=\\"_blank\\">'KODEX 미국나스닥100데일리커버드콜OTM', 순자산 1조원 돌파</a> <font color=\\"#6f6f6f\\">아시아경제</font>"}, {"link": "https://news.google.com/rss/articles/CBMiakFVX3lxTE84UWVzTnpJUTQ4dmFXM2ZxVEtOa3hmSFBKek9PWHZXcUVRZFhEWE5hM2QtR2ljb1JpVWZCY0pJeWN6MkVUcHB3YnZnM2N1cWF1VDhLWGdxRlVnQmRiLTV0YVFUVW4xOVBSR0HSAW5BVV95cUxOcXFxRzg1U21MYy1oYjFvX3FNWkFrR0E1TzZYaUlUdDNrUDlZdEpoMXpRY3BaMVNDc2c2bGc4SXF4bGVkcTJNd0dDWWt6Y25jWE9keWVFSGdDX3ducWZIMlhaNmdteXhFTDZxSTVVdw?oc=5", "title": "삼성 'KODEX 미국나스닥100데일리커버드콜OTM' 순자산 1조 돌파", "source": "뉴시안", "pubDate": "Wed, 02 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiakFVX3lxTE84UWVzTnpJUTQ4dmFXM2ZxVEtOa3hmSFBKek9PWHZXcUVRZFhEWE5hM2QtR2ljb1JpVWZCY0pJeWN6MkVUcHB3YnZnM2N1cWF1VDhLWGdxRlVnQmRiLTV0YVFUVW4xOVBSR0HSAW5BVV95cUxOcXFxRzg1U21MYy1oYjFvX3FNWkFrR0E1TzZYaUlUdDNrUDlZdEpoMXpRY3BaMVNDc2c2bGc4SXF4bGVkcTJNd0dDWWt6Y25jWE9keWVFSGdDX3ducWZIMlhaNmdteXhFTDZxSTVVdw?oc=5\\" target=\\"_blank\\">삼성 'KODEX 미국나스닥100데일리커버드콜OTM' 순자산 1조 돌파</a> <font color=\\"#6f6f6f\\">뉴시안</font>"}, {"link": "https://news.google.com/rss/articles/CBMiZEFVX3lxTE9LdDhZbVZWSTlaTy1oTnVLM05yWGVJUGxSYllSMDJDNDNTb3VDeC1WYzhHZnVfYkRFbmdBSzFkdm1LTGNlUW9WWFlzd3hra1ZZWWZsTjFrT091bWtrX0xNampZaE4?oc=5", "title": "삼성운용, ‘KODEX 미국나스닥100데일리커버드콜OTM ETF’ 순자산 1조원 돌파", "source": "매일일보", "pubDate": "Wed, 02 Sep 2026 07:00:00 GMT", "language": "ko", "description": "<a href=\\"https://news.google.com/rss/articles/CBMiZEFVX3lxTE9LdDhZbVZWSTlaTy1oTnVLM05yWGVJUGxSYllSMDJDNDNTb3VDeC1WYzhHZnVfYkRFbmdBSzFkdm1LTGNlUW9WWFlzd3hra1ZZWWZsTjFrT091bWtrX0xNampZaE4?oc=5\\" target=\\"_blank\\">삼성운용, ‘KODEX 미국나스닥100데일리커버드콜OTM ETF’ 순자산 1조원 돌파</a> <font color=\\"#6f6f6f\\">매일일보</font>"}]	{"causes": [{"id": "cause-1", "title": "환율 변동에 따른 헤지·노출 논란", "impact": "medium", "summary": "달러·원 환율 변동이 커지면서 해외 ETF 환헤지 여부가 화제. 투자자들 사이에 ‘헷갈림’이 일며 소폭 상승을 부추김.", "timeline": [{"desc": "달러 대비 원화 약세가 확대돼 해외 자산 노출 위험이 커짐.", "title": "환율 급등"}, {"desc": "투자자들, 환헤지 ETF와 비헤지 ETF 사이 선택에 고민, 매수세 소폭 발생.", "title": "헤지 논쟁"}], "conclusion": "환율 변동이 투자심리 살짝 끌어올렸다.", "newsIndices": [0, 1], "similarCase": "", "expertOpinions": {"bearish": {"count": 0, "summary": ""}, "bullish": {"count": 0, "summary": ""}}}], "oneLiner": "KODEX 나스닥100, 오늘은 미친듯이 살짝 올라갔지만, 진짜 핵폭탄은 아니니 똑똑하게 지켜보자!", "aiComment": "오늘은 급등도 급락도 아닌, 살짝 들뜬 상태라서 별다른 대박은 없었음. 환율이 요즘 애들 사이에서 뜨거운 화제라서 살짝 끌어올린 정도. 너무 신경쓰지 말고, 내일은 또 뭐가 튀어나올지 기대해보자!\\n\\n이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다."}	\N	2026-10-08 02:52:40.034+00	2026-10-08 02:52:40.173898+00
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
0abdedd0-7512-4f30-9707-15a1fe4fda1a	aedc96f9-b872-4a87-8719-ac72491432d9	015860	일진홀딩스	KOSPI	2026-09-17 02:55:46.678723+00
7c7ea1fb-a27c-42c1-b9b1-b6d9762c6bd7	aedc96f9-b872-4a87-8719-ac72491432d9	006400	삼성SDI	KOSPI	2026-09-17 02:55:46.678723+00
82efa707-5320-4cac-ae9d-e872f91f6e90	aedc96f9-b872-4a87-8719-ac72491432d9	277810	레인보우로보틱스	KOSDAQ	2026-09-17 02:55:46.678723+00
1bc6d8df-3dd8-405b-ab7d-ff8f206636fa	aedc96f9-b872-4a87-8719-ac72491432d9	247540	에코프로비엠	KOSDAQ	2026-09-17 02:55:46.678723+00
e421d105-d1ac-4073-a2f5-dac1e78362b2	aedc96f9-b872-4a87-8719-ac72491432d9	0161M0	네오사피엔스	KOSDAQ	2026-09-21 03:13:02.608887+00
9e3f3a84-768a-47b8-aff6-d41f1035517b	aedc96f9-b872-4a87-8719-ac72491432d9	097950	CJ제일제당	KOSPI	2026-09-23 07:15:53.917501+00
582a513c-0179-462f-a0ea-8b48a391ab38	aedc96f9-b872-4a87-8719-ac72491432d9	042700	한미반도체	KOSDAQ	2026-09-24 10:01:20.854259+00
4509a42c-228a-4bea-ac03-40c73d069389	aedc96f9-b872-4a87-8719-ac72491432d9	051910	LG화학	KOSPI	2026-09-24 10:01:20.854259+00
c7dbde08-f588-45e4-8eda-0b485708b584	aedc96f9-b872-4a87-8719-ac72491432d9	373220	LG에너지솔루션	KOSPI	2026-09-24 10:01:20.854259+00
d2d840f4-4c4c-4808-baba-7ff47d4fc156	aedc96f9-b872-4a87-8719-ac72491432d9	458730	TIGER 미국배당다우존스	ETF	2026-09-02 16:14:44.483037+00
00b971d8-5d6b-4266-8c21-ea1b599ff189	aedc96f9-b872-4a87-8719-ac72491432d9	379800	KODEX 미국S&P500	ETF	2026-09-02 16:14:54.300485+00
220c25b7-849d-4ed3-8d75-c8c94396985e	aedc96f9-b872-4a87-8719-ac72491432d9	083450	GST	KOSDAQ	2026-09-03 02:46:22.411334+00
a74640d7-4d25-4f1b-9013-84751ada313c	aedc96f9-b872-4a87-8719-ac72491432d9	034020	두산에너빌리티	KOSPI	2026-09-07 06:03:57.998922+00
9f7675ec-822b-40a9-8f9c-1bbd384a52a6	aedc96f9-b872-4a87-8719-ac72491432d9	058470	리노공업	KOSDAQ	2026-09-17 02:55:46.678723+00
34d75c33-fe11-48b0-b944-4381d854ed65	aedc96f9-b872-4a87-8719-ac72491432d9	006660	삼성공조	KOSPI	2026-09-17 02:55:46.678723+00
894bbc33-0097-4068-b0ef-8a520a296688	aedc96f9-b872-4a87-8719-ac72491432d9	0010S0	와이즈플래닛컴퍼니	KOSDAQ	2026-09-23 07:23:49.039363+00
fbb92297-3816-4dd5-939f-b08e3fe99a90	aedc96f9-b872-4a87-8719-ac72491432d9	009150	삼성전기	KOSPI	2026-09-28 12:48:01.302969+00
50055d2d-712c-4eaf-90ee-b4e31b5bcc0a	aedc96f9-b872-4a87-8719-ac72491432d9	487570	HS효성	KOSPI	2026-09-28 12:48:01.302969+00
95eac1d2-654f-4671-85ec-94dde32a0ca7	aedc96f9-b872-4a87-8719-ac72491432d9	225570	넥슨게임즈	KOSDAQ	2026-09-28 12:48:01.302969+00
4b0919bc-58a9-4212-9a25-9c1c8c292510	aedc96f9-b872-4a87-8719-ac72491432d9	259960	크래프톤	KOSPI	2026-09-28 12:48:01.302969+00
b06e5f69-78b0-4087-aec6-c4f9625ba330	aedc96f9-b872-4a87-8719-ac72491432d9	003680	한성기업	KOSPI	2026-09-28 12:48:01.302969+00
c5ff9166-0cd0-45bb-be76-c717872376fd	aedc96f9-b872-4a87-8719-ac72491432d9	034120	SBS	KOSPI	2026-09-28 12:48:01.302969+00
ccab9aa0-0a19-4a2d-998e-069653fa3a9f	aedc96f9-b872-4a87-8719-ac72491432d9	399720	가온칩스	KOSDAQ	2026-09-28 12:48:01.302969+00
28713888-fd30-4fba-b277-756ed650b81b	aedc96f9-b872-4a87-8719-ac72491432d9	388720	유일로보틱스	KOSDAQ	2026-09-28 12:48:01.302969+00
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

\unrestrict wZxubw1PKkVwqDzWQMEae4zpaoKhpRPa43pP1S7NfNDbgDgTM6ictPsRMcI4Fl9

