# [각주 1] 분석에 필요한 라이브러리와 환경변수를 준비합니다.
# [각주 2] KIS_APP_KEY·KIS_APP_SECRET 등 인증정보는 .env에서 읽습니다.
# SK하이닉스 종합 분석: 주가 + 네이버 뉴스 + LLM
# 필요한 패키지: pykrx, requests, pandas, python-dotenv
import os
import datetime as dt
import json
import re
import requests
import time
from pathlib import Path
import pandas as pd
from dotenv import load_dotenv
from email.utils import parsedate_to_datetime
from html import unescape
from IPython.display import display
from pykrx import stock

_dotenv_paths = [Path.cwd() / ".env"]
_dotenv_paths.append(Path.cwd() / "notebooks" / ".env")
if "__file__" in globals():
    _dotenv_paths.extend([
        Path(__file__).resolve().with_name(".env"),
        Path(__file__).resolve().parents[1] / "notebooks" / ".env",
    ])
for _dotenv_path in _dotenv_paths:
    if _dotenv_path.is_file():
        load_dotenv(_dotenv_path, override=True)

STOCK_NAME = "SK하이닉스"
STOCK_TICKER = "000660"
LOOKBACK_DAYS = 30
NEWS_COUNT = 20
REPORT_COUNT = 20

KIS_BASE_URL = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
KIS_TOKEN_URL = f"{KIS_BASE_URL}/oauth2/tokenP"
KIS_RESEARCH_URL = f"{KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/research-info"


