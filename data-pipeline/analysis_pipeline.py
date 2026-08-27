"""주가(KRX 공식 Open API) + 네이버 뉴스 + LLM 종합 분석 파이프라인.

1st prototype.ipynb의 코드를 그대로 옮긴 스크립트다. integration_test에서
importlib로 로드해 재사용하므로, 노트북의 실행 셀(마지막 부분)은
`if __name__ == "__main__":` 가드 안에 있다.
"""
import os
import datetime as dt
import re
import requests
import json
from pathlib import Path
import pandas as pd
from dotenv import load_dotenv
from email.utils import parsedate_to_datetime
from html import unescape
from IPython.display import display

_dotenv_paths = []
for _base_path in (Path.cwd(), Path.cwd().parent, Path.cwd().parent.parent):
    _dotenv_paths.extend([
        _base_path / ".env",
        _base_path / "notebooks" / ".env",
    ])
if "__file__" in globals():
    _dotenv_paths.extend([
        Path(__file__).resolve().with_name(".env"),
        Path(__file__).resolve().parents[1] / "notebooks" / ".env",
    ])
for _dotenv_path in _dotenv_paths:
    if _dotenv_path.is_file():
        load_dotenv(_dotenv_path, override=True)

STOCK_NAME = "GST"
STOCK_TICKER = "083450"
LOOKBACK_DAYS = 30
NEWS_COUNT = 20

# 공식 KRX Open API(data-dbg.krx.co.kr)의 일별매매정보 엔드포인트만 사용한다.
# PER/PBR/배당수익률은 공식 API에 없고 data.krx.co.kr 비공식 스크래핑 경로뿐이라
# 이번 리라이트에서는 다루지 않는다 (HANDOFF.md의 제품 범위 결정을 따름).
KRX_BASE_URL = "https://data-dbg.krx.co.kr/svc/apis/sto"
KRX_MARKET_PATHS = ("stk", "ksq")  # 코스피, 코스닥


def _clean_html(value: str) -> str:
    return unescape(value.replace("<b>", "").replace("</b>", "")).strip()


def _krx_auth_key() -> str:
    key = os.getenv("KRX_AUTH_KEY")
    if not key:
        raise RuntimeError(".env에 KRX_AUTH_KEY를 설정하세요.")
    return key


def _fetch_krx_day(market_path: str, bas_dd: str, key: str) -> list:
    """공식 KRX 일별매매정보 API에서 특정 날짜의 전체 종목 스냅샷을 가져온다."""
    response = requests.get(
        f"{KRX_BASE_URL}/{market_path}_bydd_trd",
        params={"AUTH_KEY": key, "basDd": bas_dd},
        timeout=20,
    )
    if not response.ok:
        raise RuntimeError(f"KRX {market_path} API 오류 ({response.status_code}): {response.text}")
    return response.json().get("OutBlock_1") or []


def _collect_krx_rows(ticker: str, days: int, market_path: str, key: str) -> list:
    rows = []
    date = dt.date.today()
    checked = 0
    max_checked = days * 2 + 10  # 주말·공휴일을 감안해 넉넉히 조회
    while len(rows) < days and checked < max_checked:
        day_rows = _fetch_krx_day(market_path, date.strftime("%Y%m%d"), key)
        row = next((item for item in day_rows if item.get("ISU_CD") == ticker), None)
        if row:
            rows.append(row)
        date -= dt.timedelta(days=1)
        checked += 1
    return rows


def get_stock_history(ticker: str, days: int = 30) -> pd.DataFrame:
    """공식 KRX 일별매매정보 API로 최근 영업일 주가·거래량을 조회한다.

    data.krx.co.kr을 스크래핑하는 pykrx 대신 KRX_AUTH_KEY로 인증하는 공식 API만 사용한다
    (비공식 스크래핑을 쓰지 않는다는 프로젝트 방침, HANDOFF.md 참고).
    """
    key = _krx_auth_key()
    for market_path in KRX_MARKET_PATHS:
        rows = _collect_krx_rows(ticker, days, market_path, key)
        if rows:
            frame = pd.DataFrame(rows)
            frame["날짜"] = pd.to_datetime(frame["BAS_DD"])
            frame = frame.set_index("날짜").sort_index()
            return pd.DataFrame({
                "시가": frame["TDD_OPNPRC"].astype(float),
                "고가": frame["TDD_HGPRC"].astype(float),
                "저가": frame["TDD_LWPRC"].astype(float),
                "종가": frame["TDD_CLSPRC"].astype(float),
                "거래량": frame["ACC_TRDVOL"].astype(float).astype("int64"),
                "등락률": frame["FLUC_RT"].astype(float),
            })
    raise RuntimeError(f"{ticker} 종목의 주가 데이터를 찾지 못했습니다.")


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


def analyze_raw(stock_name: str, ticker: str, history: pd.DataFrame, news: pd.DataFrame) -> str:
    """주가 흐름과 뉴스의 관계를 NVIDIA LLM으로 1차 분석한다 (사실 확인 목적, formal한 문체 허용)."""
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError(".env에 NVIDIA_API_KEY를 설정하세요.")

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
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-super-120b-a12b"),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        },
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"NVIDIA API 오류 ({response.status_code}): {response.text}")
    return response.json()["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# 2단계: "쩐형" 캐릭터로 재작성 (xAI Grok) — 1단계에서 나온 사실은 그대로 두고 톤만 바꾼다.
# ---------------------------------------------------------------------------

_JEONHYUNG_TONE_RULES = {
    "mild": (
        "말투 강도: 순한맛. 순화된 감탄사만 써라(헐, 미쳤다, 실화냐). "
        "반말+장난기는 있지만 진짜 욕설은 절대 쓰지 마라."
    ),
    "medium": (
        "말투 강도: 중간맛. 인터넷 밈체 허용(개- 접두어, ㅋㅋㅋ). "
        "여전히 진짜 욕설은 쓰지 마라."
    ),
    "spicy": (
        "말투 강도: 매운맛. '존나' 같은 순화된 강한 슬랭까지 써도 된다. "
        "단 혐오·비하·특정 대상 조롱은 항상 금지."
    ),
    "nuclear": (
        "말투 강도: 핵매운맛. 이 캐릭터의 최고 텐션 모드다. "
        "'존나', '개-', '미친', '씨발' 같은 표현을 감탄사로 마음껏 섞어 써도 좋다. "
        "느낌표 남발, 과장된 리액션, 초딩 개그 다 좋다 — 텐션을 최대로 끌어올려라. "
        "단, 아래 공통 금지사항은 강도와 무관하게 항상 지켜야 한다."
    ),
}

_JEONHYUNG_SYSTEM_TEMPLATE = """너는 '쩐형'이라는 캐릭터야. 주식 초보 앞에서 능글맞게 훈수 두는 친한 형/누나.
성격: 잘난 척하다가 능청스럽게 넘어감, 가끔 유치한 드립도 침. 절대 고지식하게 안 씀.

{tone_rule}

방향별 리액션 규칙:
- 급등: 살짝 들뜬 톤 + 호들갑
- 급락: 놀란 척하다 침착하게 수습하는 톤
- 횡보: 심드렁하게, "에이 뭐 볼 거 있다고" 식

비유 소재 풀: 연애, 스포츠, 게임, 학교/시험 중 하나를 매번 다르게 골라서 써라.

공통 금지사항 (강도 무관, 항상 지켜라):
- 특정 인물·기업을 비하하거나 조롱하는 표현 금지
- 성별·지역·세대 등 특정 집단을 향한 비하·혐오 표현 금지
- "사야 한다/팔아야 한다" 같은 직접적 투자 지시 문장 금지 — 재미있게 설명하되 판단은 독자 몫으로 남겨라

아래 [1단계 분석]에 있는 사실만 사용해서 다시 써라. 새로운 사실을 지어내지 마라.
반드시 아래 JSON 스키마로만 답해라 (다른 텍스트 없이 JSON 객체만):
{{
  "one_line_summary": "카드용 한 줄 요약, 공백 포함 15자 내외",
  "causal_steps": [{{"icon": "news|trend|cooldown|risk", "text": "한 문장, 쉬운 말"}}],
  "plain_explanation": "3~4문장, 쩐형 톤으로",
  "positive_factor": "긍정 요인 한 문장",
  "risk_factor": "리스크 한 문장",
  "watch_next": "다음에 확인하면 좋은 것 한 문장"
}}"""


def rewrite_plain(stock_name: str, ticker: str, raw_analysis: str, tone: str = "nuclear") -> dict:
    """1단계(analyze_raw) 결과를 '쩐형' 캐릭터 톤으로 재작성한다 (xAI Grok, JSON 강제 출력)."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise RuntimeError(".env에 XAI_API_KEY를 설정하세요.")
    if tone not in _JEONHYUNG_TONE_RULES:
        raise ValueError(f"알 수 없는 tone입니다: {tone} (mild/medium/spicy/nuclear 중 선택)")

    system = _JEONHYUNG_SYSTEM_TEMPLATE.format(tone_rule=_JEONHYUNG_TONE_RULES[tone])
    prompt = f"""[1단계 분석]
종목: {stock_name}({ticker})

{raw_analysis}"""

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
            "temperature": 0.9,
            "response_format": {"type": "json_object"},
        },
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f"xAI API 오류 ({response.status_code}): {response.text}")

    content = response.json()["choices"][0]["message"]["content"]
    try:
        plain = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"xAI 응답이 JSON이 아닙니다: {content[:300]}") from exc

    # 면책 문구는 캐릭터 톤과 무관하게 코드에서 고정으로 붙인다 (모델이 빼먹어도 항상 붙게).
    plain["disclaimer"] = "이 코멘트는 참고용 설명이며, 투자 판단과 책임은 본인에게 있습니다."
    return plain


def analyze_with_llm(
    stock_name: str,
    ticker: str,
    history: pd.DataFrame,
    news: pd.DataFrame,
    tone: str = "nuclear",
) -> dict:
    """1단계(NVIDIA 사실 분석) → 2단계(xAI '쩐형' 재작성)를 순서대로 실행한다.

    반환값: {"raw": "1단계 원본 분석 텍스트", "plain": {...2단계 JSON 스키마...}}
    """
    raw = analyze_raw(stock_name, ticker, history, news)
    plain = rewrite_plain(stock_name, ticker, raw, tone=tone)
    return {"raw": raw, "plain": plain}


if __name__ == "__main__":
    price_df = get_stock_history(STOCK_TICKER, LOOKBACK_DAYS)
    news_df = search_stock_news(STOCK_NAME, NEWS_COUNT)

    first_close = float(price_df["종가"].iloc[0])
    last_close = float(price_df["종가"].iloc[-1])
    period_return = (last_close / first_close - 1) * 100
    print(f"종목: {STOCK_NAME} ({STOCK_TICKER})")
    print(f"조회기간: {price_df.index.min().date()} ~ {price_df.index.max().date()}")
    print(f"최근 종가: {last_close:,.0f}원 | 기간 수익률: {period_return:+.2f}%")
    print(f"수집 뉴스: {len(news_df)}건")
    display(price_df.tail(10))
    display(news_df.head(10))

    llm_result = analyze_with_llm(STOCK_NAME, STOCK_TICKER, price_df, news_df)
    print()
    print("===== 1단계: 원본 분석 (NVIDIA) =====")
    print()
    print(llm_result["raw"])
    print()
    print("===== 2단계: 쩐형 코멘트 (xAI, 핵매운맛) =====")
    print()
    print(json.dumps(llm_result["plain"], ensure_ascii=False, indent=2))
