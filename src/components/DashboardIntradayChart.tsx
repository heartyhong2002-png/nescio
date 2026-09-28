"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type IntradayPoint = { date: string; close: number; high?: number; low?: number };
type ChartState = { ticker: string; points: IntradayPoint[] | null; error: boolean };

function timeLabel(value: string | undefined) {
  if (!value) return "";
  if (value.length === 4) return `${value.slice(0, 2)}:${value.slice(2)}`;
  if (value.length === 8) return `${Number(value.slice(4, 6))}/${Number(value.slice(6, 8))}`;
  return value;
}

export default function DashboardIntradayChart({ ticker, stockName }: { ticker: string; stockName: string }) {
  const [state, setState] = useState<ChartState>({ ticker: "", points: null, error: false });

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function load(attempt = 0) {
      try {
        const response = await fetch(`/api/price-history?ticker=${encodeURIComponent(ticker)}&range=1일`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "장중 차트를 불러오지 못했습니다.");
        const points = (data.points ?? []) as IntradayPoint[];
        if (data.retryable && points.length === 0 && attempt < 2) {
          timers.push(setTimeout(() => load(attempt + 1), attempt === 0 ? 2000 : 4500));
          return;
        }
        if (!cancelled) setState({ ticker, points, error: false });
      } catch {
        if (!cancelled) setState({ ticker, points: [], error: true });
      }
    }

    void load();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [ticker]);

  const points = state.ticker === ticker ? state.points : null;
  const chart = useMemo(() => {
    if (!points?.length) return null;
    const width = 600;
    const height = 158;
    const padX = 4;
    const padY = 12;
    const values = points.map((point) => point.close);
    let min = Math.min(...points.map((point) => point.low ?? point.close));
    let max = Math.max(...points.map((point) => point.high ?? point.close));
    if (min === max) {
      const padding = Math.max(max * 0.002, 1);
      min -= padding;
      max += padding;
    }
    const range = max - min;
    const coords = values.map((value, index) => ({
      x: padX + (index / Math.max(1, values.length - 1)) * (width - padX * 2),
      y: padY + (1 - (value - min) / range) * (height - padY * 2),
    }));
    const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const area = `${line} L${coords.at(-1)!.x.toFixed(2)} ${height} L${coords[0].x.toFixed(2)} ${height} Z`;
    const first = points[0];
    const last = points[points.length - 1];
    return { line, area, first: timeLabel(first.date), last: timeLabel(last.date), isUp: last.close >= first.close };
  }, [points]);

  if (points === null) {
    return (
      <div className="dashboard-chart-frame" role="status" aria-label={`${stockName} 장중 차트 불러오는 중`}>
        <div className="dashboard-chart-grid" aria-hidden="true"><i /><i /><i /></div>
        <div className="dashboard-chart-skeleton" aria-hidden="true" />
      </div>
    );
  }

  if (state.error) {
    return <div className="dashboard-chart-empty" role="status">장중 흐름을 불러오지 못했어요. 잠시 후 종목 상세에서 확인해 주세요.</div>;
  }

  if (!chart) {
    return <div className="dashboard-chart-empty" role="status">현재 제공되는 장중 차트 데이터가 없어요.</div>;
  }

  return (
    <div className={`dashboard-chart-frame ${chart.isUp ? "up" : "down"}`}>
      <svg className="dashboard-history-chart" viewBox="0 0 600 158" preserveAspectRatio="none" role="img" aria-label={`${stockName} 장중 주가 흐름. 시작 ${formatPrice(points[0].close)}원, 현재 ${formatPrice(points.at(-1)!.close)}원`}>
        <defs>
          <linearGradient id="dashboardHistoryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="dashboard-history-grid" d="M0 24H600M0 79H600M0 134H600" />
        <path className="dashboard-history-area" d={chart.area} />
        <path className="dashboard-history-line" d={chart.line} />
      </svg>
      <div className="dashboard-chart-times"><span>{chart.first}</span><span>{chart.last}</span></div>
    </div>
  );
}
