--
-- PostgreSQL database dump
--

\restrict s11LpLS0ZJoNDzKTM3YlLcgWingUPyRIYkQ5Xte68vttv2gXQudNhqgUrEtvtA2

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
b06e5f69-78b0-4087-aec6-c4f9625ba330	aedc96f9-b872-4a87-8719-ac72491432d9	003680	한성기업	KOSPI	2026-09-28 12:48:01.302969+00
84fcbe41-e71a-4d4a-9e04-9e49d9477274	aedc96f9-b872-4a87-8719-ac72491432d9	024060	흥구석유	KOSDAQ	2026-09-28 12:48:01.302969+00
95eac1d2-654f-4671-85ec-94dde32a0ca7	aedc96f9-b872-4a87-8719-ac72491432d9	225570	넥슨게임즈	KOSDAQ	2026-09-28 12:48:01.302969+00
4b0919bc-58a9-4212-9a25-9c1c8c292510	aedc96f9-b872-4a87-8719-ac72491432d9	259960	크래프톤	KOSPI	2026-09-28 12:48:01.302969+00
c5ff9166-0cd0-45bb-be76-c717872376fd	aedc96f9-b872-4a87-8719-ac72491432d9	034120	SBS	KOSPI	2026-09-28 12:48:01.302969+00
50055d2d-712c-4eaf-90ee-b4e31b5bcc0a	aedc96f9-b872-4a87-8719-ac72491432d9	487570	HS효성	KOSPI	2026-09-28 12:48:01.302969+00
ccab9aa0-0a19-4a2d-998e-069653fa3a9f	aedc96f9-b872-4a87-8719-ac72491432d9	399720	가온칩스	KOSDAQ	2026-09-28 12:48:01.302969+00
28713888-fd30-4fba-b277-756ed650b81b	aedc96f9-b872-4a87-8719-ac72491432d9	388720	유일로보틱스	KOSDAQ	2026-09-28 12:48:01.302969+00
fbb92297-3816-4dd5-939f-b08e3fe99a90	aedc96f9-b872-4a87-8719-ac72491432d9	009150	삼성전기	KOSPI	2026-09-28 12:48:01.302969+00
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

\unrestrict s11LpLS0ZJoNDzKTM3YlLcgWingUPyRIYkQ5Xte68vttv2gXQudNhqgUrEtvtA2

