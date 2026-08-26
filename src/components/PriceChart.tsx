"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";

type PricePoint = { date: string; close: number };

function formatDateLabel(basDd: string) {
  return `${basDd.slice(0, 4)}-${basDd.slice(4, 6)}-${basDd.slice(6, 8)}`;
}

export default function PriceChart({ ticker, range }: { ticker: string; range: string }) {
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (range === "1일") return;
    let cancelled = false;
    fetch(`/api/price-history?ticker=${encodeURIComponent(ticker)}&range=${encodeURIComponent(range)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "가격 이력을 불러오지 못했습니다.");
        if (!cancelled) setPoints(data.points);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "가격 이력을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  if (range === "1일") {
    return (
      <div className="placeholder-box" data-testid="price-chart" style={{ height: 150, marginBottom: 10 }}>
        분봉 차트는 준비 중이에요
      </div>
    );
  }

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
        표시할 가격 데이터가 없어요
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
            formatter={(value) => [`${formatPrice(Number(value))}원`, "종가"]}
            labelFormatter={(label) => formatDateLabel(String(label))}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} fill="url(#priceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
