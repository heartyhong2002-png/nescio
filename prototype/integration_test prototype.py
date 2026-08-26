"""1st prototype.ipynb.py의 파이프라인 함수를 그대로 재사용해
5개 종목에 대해 순차적으로 통합 테스트를 실행한다.

원본 스크립트는 수정하지 않는다(단, 모듈로 임포트했을 때 맨 아래 실행부가
자동으로 돌지 않도록 `if __name__ == "__main__":` 가드만 걸려 있어야 한다).
importlib로 스크립트를 모듈로 로드해 그 안에 정의된
get_stock_history / search_stock_news / get_stock_reports / analyze_with_llm
함수를 종목별로 호출한다. get_stock_reports는 KIS→네이버→한경 폴백을
포함하므로, 이 컴퓨터·이 .env 조합에서 리포트 수집까지 실제로 되는지도
함께 검증된다. 종목 하나가 실패해도 나머지 종목은 계속 진행하고,
종목 사이에는 뉴스/LLM API의 초당 요청 제한과 "진짜 버그"를 구분할 수
있도록 짧게 대기한 뒤, 마지막에 종목별 성공/실패를 요약해서 보여준다.

실행: python "integration_test prototype.py"
"""
import importlib.util
import sys
import time
import traceback
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().with_name("1st prototype.ipynb.py")
REQUIRED_FUNCTIONS = (
    "get_stock_history",
    "search_stock_news",
    "get_stock_reports",
    "analyze_with_llm",
)
STOCK_INTERVAL_SECONDS = 1.0

TEST_STOCKS = [
    ("삼성전자", "005930"),
    ("SK하이닉스", "000660"),
    ("NAVER", "035420"),
    ("카카오", "035720"),
    ("LG에너지솔루션", "373220"),
]


def _load_pipeline_module():
    """1st prototype.ipynb.py를 모듈로 로드해 파이프라인 함수를 가져온다."""
    if not SCRIPT_PATH.is_file():
        raise RuntimeError(f"스크립트를 찾지 못했습니다: {SCRIPT_PATH}")

    spec = importlib.util.spec_from_file_location("prototype_pipeline", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"스크립트를 모듈로 로드하지 못했습니다: {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    missing_funcs = [name for name in REQUIRED_FUNCTIONS if not hasattr(module, name)]
    if missing_funcs:
        raise RuntimeError(f"스크립트에서 함수를 찾지 못했습니다: {missing_funcs}")
    return module


def _run_stock(module, name: str, ticker: str, lookback_days: int, news_count: int, report_count: int):
    try:
        price_df = module.get_stock_history(ticker, lookback_days)
    except Exception as exc:
        raise RuntimeError(f"[주가] {exc}") from exc
    last_close = float(price_df["종가"].iloc[-1])
    print(f"  주가 {len(price_df)}일치 수집, 최근 종가 {last_close:,.0f}원")

    try:
        news_df = module.search_stock_news(name, news_count)
    except Exception as exc:
        raise RuntimeError(f"[뉴스] {exc}") from exc
    print(f"  뉴스 {len(news_df)}건 수집")

    try:
        reports_df = module.get_stock_reports(ticker, report_count)
    except Exception as exc:
        raise RuntimeError(f"[리포트] {exc}") from exc
    report_source = reports_df["source"].iloc[0] if not reports_df.empty else "없음"
    print(f"  리포트 {len(reports_df)}건 수집 ({report_source})")

    try:
        report = module.analyze_with_llm(name, ticker, price_df, news_df)
    except Exception as exc:
        raise RuntimeError(f"[LLM] {exc}") from exc
    print(f"  LLM 분석 {len(report)}자 생성")


def run_integration_test(lookback_days: int = 30, news_count: int = 20, report_count: int = 20) -> bool:
    module = _load_pipeline_module()

    results = []
    for index, (name, ticker) in enumerate(TEST_STOCKS):
        print(f"\n{'=' * 60}")
        print(f"[{name} ({ticker})] 테스트 시작")
        print("=" * 60)
        try:
            _run_stock(module, name, ticker, lookback_days, news_count, report_count)
            results.append((name, ticker, True, None))
        except Exception as exc:
            print(f"  실패: {exc}")
            traceback.print_exc()
            results.append((name, ticker, False, str(exc)))
        finally:
            if index < len(TEST_STOCKS) - 1:
                time.sleep(STOCK_INTERVAL_SECONDS)

    print(f"\n{'=' * 60}")
    print("통합 테스트 결과 요약")
    print("=" * 60)
    ok_count = 0
    for name, ticker, ok, error in results:
        status = "OK" if ok else f"FAIL ({error})"
        ok_count += 1 if ok else 0
        print(f"  {name} ({ticker}): {status}")
    print(f"\n{ok_count}/{len(results)} 종목 성공")

    return ok_count == len(results)


if __name__ == "__main__":
    success = run_integration_test()
    sys.exit(0 if success else 1)
