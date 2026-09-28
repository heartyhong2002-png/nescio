# [각주 3] 아래 함수들은 주가·뉴스·증권사 리포트를 조회하고 공통 형식으로 정리합니다.
# KIS 조회 실패 시 네이버 증권, 한경컨센서스 순으로 자동 폴백합니다.
def _clean_html(value: str) -> str:
    return unescape(value.replace("<b>", "").replace("</b>", "")).strip()


def get_stock_history(ticker: str, days: int = 30) -> pd.DataFrame:
    """최근 영업일 주가와 거래량을 조회한다."""
    end = dt.date.today()
    start = end - dt.timedelta(days=days)
    history = stock.get_market_ohlcv_by_date(
        start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), ticker
    )
    if history.empty:
        raise RuntimeError(f"{ticker} 종목의 주가 데이터를 찾지 못했습니다.")
    return history


def search_stock_news(query: str, display: int = 20) -> pd.DataFrame:
    """네이버 뉴스 검색 API에서 최신 관련 기사를 가져온다."""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError(".env에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정하세요.")

    response = requests.get(
        "https://openapi.naver.com/v1/search/news.json",
        headers={
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
        },
        params={"query": query, "display": display, "sort": "date"},
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"네이버 뉴스 API 오류 ({response.status_code}): {response.text}")

    rows = []
    for item in response.json().get("items", []):
        published_at = item.get("pubDate")
        rows.append({
            "title": _clean_html(item.get("title", "")),
            "description": _clean_html(item.get("description", "")),
            "link": item.get("link", ""),
            "pubDate": (
                parsedate_to_datetime(published_at)
                if published_at
                else None
            ),
        })
    return pd.DataFrame(rows)


def _number(value):
    """문자열 숫자에서 쉼표·통화기호를 제거해 숫자로 변환한다."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).replace(",", "").replace("원", "").strip()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group()) if match else None


def _recommendation(value: str) -> str:
    """증권사별 투자의견을 매수·중립·매도로 통일한다."""
    text = str(value or "").strip().lower().replace(" ", "")
    if any(word in text for word in ("매수", "buy", "outperform", "overweight", "strongbuy")):
        return "매수"
    if any(word in text for word in ("매도", "sell", "underperform", "underweight", "reduce")):
        return "매도"
    if any(word in text for word in ("중립", "보유", "hold", "neutral", "marketperform")):
        return "중립"
    return str(value or "").strip()


def _report_frame(rows) -> pd.DataFrame:
    columns = ["date", "broker", "title", "recommendation", "target_price", "source", "url"]
    frame = pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(columns=columns)
    for column in columns:
        if column not in frame:
            frame[column] = None
    frame["recommendation"] = frame["recommendation"].map(_recommendation)
    frame["target_price"] = frame["target_price"].map(_number)
    return frame[columns].reset_index(drop=True)


KIS_TOKEN_CACHE_PATH = Path(".kis_token_cache.json")


def _kis_access_token(force_refresh: bool = False) -> str:
    app_key = os.getenv("KIS_APP_KEY")
    app_secret = os.getenv("KIS_APP_SECRET")
    if not app_key or not app_secret:
        raise RuntimeError(".env에 KIS_APP_KEY와 KIS_APP_SECRET을 설정하세요.")
    if not force_refresh and KIS_TOKEN_CACHE_PATH.exists():
        try:
            cache = json.loads(KIS_TOKEN_CACHE_PATH.read_text(encoding="utf-8"))
            if (
                cache.get("app_key") == app_key
                and time.time() < cache.get("expires_at", 0)
                and cache.get("access_token")
            ):
                return cache["access_token"]
        except (OSError, json.JSONDecodeError):
            pass

    response = requests.post(
        KIS_TOKEN_URL,
        json={
            "grant_type": "client_credentials",
            "appkey": app_key,
            "appsecret": app_secret,
        },
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"KIS 토큰 발급 오류 ({response.status_code}): {response.text}")
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("KIS 토큰 응답에 access_token이 없습니다.")
    KIS_TOKEN_CACHE_PATH.write_text(
        json.dumps({
            "app_key": app_key,
            "access_token": token,
            "expires_at": time.time() + int(response.json().get("expires_in", 86400)) - 300,
        }),
        encoding="utf-8",
    )
    return token


def _get_kis_reports(ticker: str, count: int) -> pd.DataFrame:
    app_key = os.getenv("KIS_APP_KEY")
    app_secret = os.getenv("KIS_APP_SECRET")
    token = _kis_access_token()
    response = requests.get(
        KIS_RESEARCH_URL,
        headers={
            "authorization": f"Bearer {token}",
            "appkey": app_key,
            "appsecret": app_secret,
            "tr_id": "FHKST01010900",
            "custtype": "P",
            "content-type": "application/json; charset=utf-8",
        },
        params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"KIS 종목투자의견 API 오류 ({response.status_code}): {response.text}")
    payload = response.json()
    if str(payload.get("rt_cd", "0")) != "0":
        raise RuntimeError(f"KIS 종목투자의견 API 오류: {payload.get('msg1', payload)}")

    output = payload.get("output1") or payload.get("output") or []
    if isinstance(output, dict):
        output = [output]
    rows = []
    for item in output:
        rows.append({
            "date": item.get("stck_bsop_date") or item.get("date") or item.get("rpt_dt"),
            "broker": (
                item.get("증권사")
                or item.get("brk_name")
                or item.get("broker_name")
                or item.get("invt_opnn_org")
            ),
            "title": item.get("rpt_nm") or item.get("report_title") or item.get("title"),
            "recommendation": (
                item.get("invt_opnn")
                or item.get("invt_opnn_cls")
                or item.get("opinion")
                or item.get("recommendation")
            ),
            "target_price": (
                item.get("목표주가")
                or item.get("stck_tgpr")
                or item.get("target_price")
                or item.get("tgt_prc")
            ),
            "source": "KIS",
            "url": item.get("url") or item.get("report_url"),
        })
    frame = _report_frame(rows)
    if frame.empty:
        raise RuntimeError("KIS 종목투자의견 API가 리포트를 반환하지 않았습니다.")
    return frame.head(count)


def _get_naver_reports(ticker: str, count: int) -> pd.DataFrame:
    url = f"https://finance.naver.com/research/company_list.naver?searchType=itemCode&itemCode={ticker}"
    response = requests.get(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=20,
    )
    response.raise_for_status()
    tables = pd.read_html(response.text)
    rows = []
    for table in tables:
        table.columns = [str(column).strip() for column in table.columns]
        opinion_column = next((c for c in table.columns if "의견" in c), None)
        target_column = next((c for c in table.columns if "목표" in c), None)
        if not opinion_column or not target_column:
            continue
        for _, item in table.iterrows():
            rows.append({
                "date": item.get("날짜") or item.get("작성일"),
                "broker": item.get("증권사"),
                "title": item.get("제목"),
                "recommendation": item.get(opinion_column),
                "target_price": item.get(target_column),
                "source": "네이버 증권",
                "url": url,
            })
    frame = _report_frame(rows)
    if frame.empty:
        raise RuntimeError("네이버 증권 리서치 탭에서 리포트를 찾지 못했습니다.")
    return frame.head(count)


def _get_hankyung_reports(ticker: str, count: int) -> pd.DataFrame:
    url = f"https://consensus.hankyung.com/analysis/search?item_code={ticker}"
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    response.raise_for_status()
    tables = pd.read_html(response.text)
    rows = []
    for table in tables:
        table.columns = [str(column).strip() for column in table.columns]
        opinion_column = next((c for c in table.columns if "의견" in c), None)
        target_column = next((c for c in table.columns if "목표" in c), None)
        if not opinion_column or not target_column:
            continue
        for _, item in table.iterrows():
            rows.append({
                "date": item.get("작성일") or item.get("날짜"),
                "broker": item.get("증권사"),
                "title": item.get("리포트명") or item.get("제목"),
                "recommendation": item.get(opinion_column),
                "target_price": item.get(target_column),
                "source": "한경컨센서스",
                "url": url,
            })
    frame = _report_frame(rows)
    if frame.empty:
        raise RuntimeError("한경컨센서스에서 리포트를 찾지 못했습니다.")
    return frame.head(count)


def get_stock_reports(ticker: str, count: int = 20) -> pd.DataFrame:
    """KIS 종목투자의견을 조회하고 실패하면 네이버, 한경 순으로 폴백한다."""
    if not re.fullmatch(r"\d{6}", ticker):
        raise ValueError("ticker는 6자리 숫자여야 합니다.")

    errors = []
    for source in (_get_kis_reports, _get_naver_reports, _get_hankyung_reports):
        try:
            reports = source(ticker, count)
            if not reports.empty:
                return reports
        except (requests.RequestException, ValueError, RuntimeError, ImportError) as error:
            errors.append(f"{source.__name__}: {error}")
    raise RuntimeError("증권사 리포트를 수집하지 못했습니다. " + " | ".join(errors))


def analyze_with_llm(stock_name: str, ticker: str, history: pd.DataFrame, news: pd.DataFrame) -> str:
    """주가 흐름과 뉴스의 관계를 xAI LLM에 분석시킨다."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise RuntimeError(".env에 XAI_API_KEY를 설정하세요.")

    price = history.copy().reset_index()
    price_text = price.tail(15).to_string(index=False)
    news_text = (
        news[["title", "description", "pubDate", "link"]].to_string(index=False)
        if not news.empty
        else "관련 뉴스 없음"
    )

    system = """너는 한국 주식 리서치 애널리스트다. 제공된 데이터만 근거로 분석하고, 확인된 사실과 해석을 구분하라.
투자 매수·매도 권유나 확정적인 미래 예측은 하지 말라."""
    prompt = f"""다음은 {stock_name}({ticker})의 최근 주가와 네이버 뉴스다.

[주가 데이터]
{price_text}

[관련 뉴스]
{news_text}

아래 형식으로 한국어 종합 분석을 작성해라.
1. 최근 주가 흐름: 기간 수익률, 고점·저점, 거래량 변화
2. 핵심 뉴스 요약: 주가에 영향을 줄 수 있는 뉴스 3~5개
3. 주가 변동 원인: 뉴스와 주가·거래량의 시간적 흐름을 연결한 근거 중심 분석
4. 긍정 요인과 부정 요인
5. 추가 확인할 리스크와 다음 거래일에 관찰할 지표
각 항목은 간결한 문단 또는 bullet로 작성하고, 근거가 부족하면 '판단 유보'라고 표시해라."""

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": os.getenv("XAI_MODEL", "grok-4-1-fast-non-reasoning"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        },
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"xAI API 오류 ({response.status_code}): {response.text}")
    return response.json()["choices"][0]["message"]["content"]


