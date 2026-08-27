"""1st prototype.ipynb.py 파이프라인을 커맨드라인에서 실행하기 위한 스크립트.

종목명과 종목코드를 인자로 받아 주가(KRX 공식 API) 조회, 네이버 뉴스 수집,
LLM 종합 분석(1단계 NVIDIA 사실 분석 → 2단계 xAI '쩐형' 캐릭터 재작성)을 한 번에
실행하고 결과를 출력한다.

실행: python run_analysis.py <종목명> <종목코드> [--days 30] [--news 20] [--tone nuclear]
예시: python run_analysis.py SK하이닉스 000660
예시: python run_analysis.py SK하이닉스 000660 --tone mild
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

SCRIPT_PATH = Path(__file__).resolve().with_name("1st prototype.ipynb.py")


def _load_pipeline_module():
    """1st prototype.ipynb.py를 모듈로 로드해 파이프라인 함수를 가져온다."""
    if not SCRIPT_PATH.is_file():
        raise RuntimeError(f"스크립트를 찾지 못했습니다: {SCRIPT_PATH}")

    spec = importlib.util.spec_from_file_location("prototype_pipeline", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"스크립트를 모듈로 로드하지 못했습니다: {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="종목 주가 + 네이버 뉴스 + LLM 종합 분석")
    parser.add_argument("name", nargs="?", default="삼성공조", help="종목명 (예: SK하이닉스, 기본값: 삼성공조)")
    parser.add_argument("ticker", nargs="?", default="006660", help="종목코드 6자리 (예: 000660, 기본값: 006660)")
    parser.add_argument("--days", type=int, default=30, help="주가 조회 기간(영업일 기준, 기본 30)")
    parser.add_argument("--news", type=int, default=20, help="수집할 뉴스 건수(기본 20)")
    parser.add_argument(
        "--tone",
        default="nuclear",
        choices=["mild", "medium", "spicy", "nuclear"],
        help="'쩐형' 캐릭터 말투 강도 (기본값: nuclear=핵매운맛)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    module = _load_pipeline_module()

    price_df = module.get_stock_history(args.ticker, args.days)
    news_df = module.search_stock_news(args.name, args.news)

    first_close = float(price_df["종가"].iloc[0])
    last_close = float(price_df["종가"].iloc[-1])
    period_return = (last_close / first_close - 1) * 100
    print(f"종목: {args.name} ({args.ticker})")
    print(f"조회기간: {price_df.index.min().date()} ~ {price_df.index.max().date()}")
    print(f"최근 종가: {last_close:,.0f}원 | 기간 수익률: {period_return:+.2f}%")
    print(f"수집 뉴스: {len(news_df)}건")
    print(price_df.tail(10))
    print(news_df.head(10))

    llm_result = module.analyze_with_llm(args.name, args.ticker, price_df, news_df, tone=args.tone)
    print()
    print("===== 1단계: 원본 분석 (NVIDIA) =====")
    print()
    print(llm_result["raw"])
    print()
    print(f"===== 2단계: 쩐형 코멘트 (xAI, {args.tone}) =====")
    print()
    print(json.dumps(llm_result["plain"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"실패: {exc}", file=sys.stderr)
        sys.exit(1)
