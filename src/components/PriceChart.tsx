"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";

type PricePoint = { date: string; close: number };

// 분봉은 "HHMM"(4자리), 일/주/월봉은 "YYYYMMDD"(8자리)로 넘어온다.
function formatPointLabel(raw: string) {
  if (raw.length === 4) return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
}

// KIS 레이트리밋은 대부분 몇 초 안에 풀린다. 바로 에러를 띄우지 말고 조용히 몇 번 더 시도한다.
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [1200, 2500, 4500, 7000];

export default function PriceChart({ ticker, range }: { ticker: string; range: string }) {
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const load = async (attempt: number) => {
      try {
        const response = await fetch(
          `/api/price-history?ticker=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "가격 이력을 불러오지 못했습니다.");
        if (cancelled) return;

        // 레이트리밋 등 일시적 실패(retryable) — 빈 결과면 잠시 뒤 다시.
        if (data.retryable && (data.points?.length ?? 0) === 0 && attempt < MAX_RETRIES) {
          timers.push(setTimeout(() => load(attempt + 1), RETRY_DELAYS_MS[attempt] ?? 7000));
          return;
        }
        setPoints(data.points ?? []);
      } catch (requestError) {
        if (cancelled) return;
        if (attempt < MAX_RETRIES) {
          timers.push(setTimeout(() => load(attempt + 1), RETRY_DELAYS_MS[attempt] ?? 7000));
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "가격 이력을 불러오지 못했습니다.");
      }
    };

    load(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [ticker, range]);

  if (error) {
    return (
      <div className="placeholder-box" data-testid="price-chart" style={{ height: 150, marginBottom: 10 }}>
        {error}
      </div>
    );
  }

  if (!points) {
    return <div className="skeleton" data-testid="price-chart" style={{ height: 150, marginBottom: 10, borderRadius: 12 }} />;
  }

  if (points.length === 0) {
    return (
      <div className="placeholder-box" data-testid="price-chart" style={{ height: 150, marginBottom: 10 }}>
        {range === "1일" ? "장 시작 전이거나 휴장일이라 분봉이 없어요" : "표시할 가격 데이터가 없어요"}
      </div>
    );
  }

  const isUp = points[points.length - 1].close >= points[0].close;
  const lineColor = isUp ? "var(--up)" : "var(--down)";

  return (
    <div data-testid="price-chart" style={{ height: 150, marginBottom: 10 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            formatter={(value) => [`${formatPrice(Number(value))}원`, range === "1일" ? "체결가" : "종가"]}
            labelFormatter={(label) => formatPointLabel(String(label))}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} fill="url(#priceFill)" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
