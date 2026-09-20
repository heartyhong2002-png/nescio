"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { formatPrice } from "@/lib/format";

export type PricePoint = {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
};

interface PriceChartProps {
  ticker: string;
  range: string;
  onRangeChange?: (range: string) => void;
  height?: number;
}

const RANGES = ["1일", "1주", "1개월", "1년"];
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [1200, 2500, 4500, 7000];

// 날짜 포맷 (YYYYMMDD -> 26.06.19 / HHMM -> 09:30)
function formatDateLabel(raw: string, short = false): string {
  if (!raw) return "";
  if (raw.length === 4) {
    return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
  }
  if (raw.length === 8) {
    const yy = raw.slice(2, 4);
    const mm = raw.slice(4, 6);
    const dd = raw.slice(6, 8);
    if (short) return `${parseInt(mm, 10)}월 ${parseInt(dd, 10)}일`;
    return `${yy}.${mm}.${dd}`;
  }
  return raw;
}

// 거래량 포맷 (20.76M / 15.2K 등)
function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString();
}

// 이동평균선(SMA) 계산
function calculateSMA(data: { close: number }[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) {
      sum -= data[i - period].close;
    }
    if (i >= period - 1) {
      result.push(sum / period);
    } else {
      result.push(null);
    }
  }
  return result;
}

// 거래량 이동평균선(SMA) 계산
function calculateVolSMA(data: { volume: number }[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].volume;
    if (i >= period) {
      sum -= data[i - period].volume;
    }
    if (i >= period - 1) {
      result.push(sum / period);
    } else {
      result.push(null);
    }
  }
  return result;
}

export default function PriceChart({ ticker, range, onRangeChange, height = 370 }: PriceChartProps) {
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState("");
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [prevQuery, setPrevQuery] = useState({ ticker, range });
  if (prevQuery.ticker !== ticker || prevQuery.range !== range) {
    setPrevQuery({ ticker, range });
    setPoints(null);
    setError("");
  }

  // 데이터 로드
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

        if (data.retryable && (data.points?.length ?? 0) === 0 && attempt < MAX_RETRIES) {
          timers.push(setTimeout(() => load(attempt + 1), RETRY_DELAYS_MS[attempt] ?? 7000));
          return;
        }

        const normalized: PricePoint[] = (data.points ?? []).map((p: PricePoint) => {
          const close = p.close;
          const open = p.open ?? close;
          const high = p.high ?? Math.max(open, close);
          const low = p.low ?? Math.min(open, close);
          const volume = p.volume ?? 0;
          return { ...p, open, high, low, close, volume };
        });

        setPoints(normalized);
        setError("");
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

  // 이동평균선 데이터 계산
  const maData = useMemo(() => {
    if (!points || points.length === 0) return { ma5: [], ma20: [], ma60: [], ma120: [], volMa20: [] };
    return {
      ma5: calculateSMA(points, 5),
      ma20: calculateSMA(points, 20),
      ma60: calculateSMA(points, 60),
      ma120: calculateSMA(points, 120),
      volMa20: calculateVolSMA(points.map((p) => ({ volume: p.volume ?? 0 })), 20),
    };
  }, [points]);

  // 최고점 / 최저점 계산
  const extremes = useMemo(() => {
    if (!points || points.length === 0) return null;
    let maxIdx = 0;
    let minIdx = 0;
    let maxVal = -Infinity;
    let minVal = Infinity;

    points.forEach((p, idx) => {
      const high = p.high ?? p.close;
      const low = p.low ?? p.close;
      if (high > maxVal) {
        maxVal = high;
        maxIdx = idx;
      }
      if (low < minVal) {
        minVal = low;
        minIdx = idx;
      }
    });

    const currentPrice = points[points.length - 1].close;
    const maxChangePercent = maxVal > 0 ? ((currentPrice - maxVal) / maxVal) * 100 : 0;
    const minChangePercent = minVal > 0 ? ((currentPrice - minVal) / minVal) * 100 : 0;

    return {
      maxIdx,
      maxVal,
      maxChangePercent,
      maxDate: formatDateLabel(points[maxIdx].date),
      minIdx,
      minVal,
      minChangePercent,
      minDate: formatDateLabel(points[minIdx].date),
    };
  }, [points]);

  // 차트 렌더링 함수
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points || points.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const currentHeight = rect.height;

    if (width === 0 || currentHeight === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(currentHeight * dpr);
    ctx.scale(dpr, dpr);

    // 차트 레이아웃 분할
    const rightAxisWidth = 68;
    const bottomAxisHeight = 26;
    const chartWidth = Math.max(10, width - rightAxisWidth);
    const totalContentHeight = Math.max(10, currentHeight - bottomAxisHeight);

    const volumeHeight = showVolume ? Math.min(80, totalContentHeight * 0.24) : 0;
    const priceHeight = Math.max(10, totalContentHeight - volumeHeight);

    // 1. 배경 클리어 (화이트 테마)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, currentHeight);

    // 2. 가격 범위 계산
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    points.forEach((p) => {
      minPrice = Math.min(minPrice, p.low ?? p.close);
      maxPrice = Math.max(maxPrice, p.high ?? p.close);
    });

    // 이평선도 포함하여 Y축 범위 확장
    if (showMA) {
      [maData.ma5, maData.ma20, maData.ma60, maData.ma120].forEach((maList) => {
        maList.forEach((val) => {
          if (val !== null) {
            minPrice = Math.min(minPrice, val);
            maxPrice = Math.max(maxPrice, val);
          }
        });
      });
    }

    if (minPrice === maxPrice || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      minPrice *= 0.95;
      maxPrice *= 1.05;
    }
    const pricePadding = Math.max(1, (maxPrice - minPrice) * 0.12);
    const priceYMin = minPrice - pricePadding;
    const priceYMax = maxPrice + pricePadding;
    const priceSpan = Math.max(1, priceYMax - priceYMin);

    const priceToY = (price: number) => {
      return priceHeight - ((price - priceYMin) / priceSpan) * priceHeight;
    };

    // 3. 거래량 범위 계산
    let maxVolume = 1;
    if (showVolume) {
      points.forEach((p) => {
        maxVolume = Math.max(maxVolume, p.volume ?? 0);
      });
      maData.volMa20.forEach((val) => {
        if (val !== null) maxVolume = Math.max(maxVolume, val);
      });
      maxVolume *= 1.15; // 상단 여유
    }

    const volToY = (vol: number) => {
      if (!showVolume || maxVolume === 0) return totalContentHeight;
      const h = (vol / maxVolume) * Math.max(0, volumeHeight - 8);
      return totalContentHeight - h;
    };

    // 4. X축 좌표 계산 함수
    const count = points.length;
    const barWidth = Math.max(2, Math.min(22, (chartWidth / count) * 0.7));
    const step = chartWidth / count;
    const getX = (i: number) => i * step + step / 2;

    // 5. 그리드 라인 & Y축 눈금 (가격) - 라이트 테마
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f1f2f7";
    ctx.fillStyle = "#8b8fa3";
    ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const priceTicks = 5;
    for (let i = 0; i < priceTicks; i++) {
      const p = priceYMin + (priceSpan / (priceTicks - 1)) * i;
      const y = Math.round(priceToY(p));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      ctx.fillText(formatPrice(Math.round(p)), chartWidth + 6, y);
    }

    // 6. 거래량 그리드 분리선 & 눈금
    if (showVolume) {
      ctx.strokeStyle = "#e6e4ef";
      ctx.beginPath();
      ctx.moveTo(0, priceHeight);
      ctx.lineTo(width, priceHeight);
      ctx.stroke();

      ctx.fillStyle = "#9ba0b4";
      ctx.fillText(formatVolume(maxVolume), chartWidth + 6, priceHeight + 12);
    }

    // 7. X축 눈금 및 라벨 (월/일 또는 시간)
    ctx.strokeStyle = "#f1f2f7";
    ctx.fillStyle = "#8b8fa3";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const xLabelInterval = Math.max(1, Math.floor(count / 6));
    for (let i = 0; i < count; i += xLabelInterval) {
      const x = Math.round(getX(i));
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalContentHeight);
      ctx.stroke();

      const label = formatDateLabel(points[i].date, true);
      ctx.fillText(label, x, totalContentHeight + 6);
    }

    // 8. 거래량 바 렌더링
    if (showVolume) {
      for (let i = 0; i < count; i++) {
        const p = points[i];
        const vol = p.volume ?? 0;
        if (vol <= 0) continue;

        const x = getX(i);
        const y = volToY(vol);
        const barH = totalContentHeight - y;
        const isUp = (p.close ?? 0) >= (p.open ?? p.close);

        ctx.fillStyle = isUp ? "#f04452" : "#3182f6";
        ctx.fillRect(x - barWidth / 2, y, barWidth, barH);
      }

      // 거래량 20일 이동평균선 (진한 하늘색)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#0284c7";
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < count; i++) {
        const val = maData.volMa20[i];
        if (val === null) continue;
        const x = getX(i);
        const y = volToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 9. 메인 차트: 캔들스틱 or 라인
    if (chartType === "candle") {
      for (let i = 0; i < count; i++) {
        const p = points[i];
        const open = p.open ?? p.close;
        const close = p.close;
        const high = p.high ?? Math.max(open, close);
        const low = p.low ?? Math.min(open, close);
        const isUp = close >= open;

        const x = getX(i);
        const yOpen = priceToY(open);
        const yClose = priceToY(close);
        const yHigh = priceToY(high);
        const yLow = priceToY(low);

        const color = isUp ? "#f04452" : "#3182f6";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        // 꼬리 (Wick)
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // 몸통 (Body)
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));
        ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
      }
    } else {
      // 라인 차트 렌더링
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#3182f6";
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = getX(i);
        const y = priceToY(points[i].close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 그라데이션 영역 채우기
      const grad = ctx.createLinearGradient(0, 0, 0, priceHeight);
      grad.addColorStop(0, "rgba(49, 130, 246, 0.16)");
      grad.addColorStop(1, "rgba(49, 130, 246, 0.0)");
      ctx.fillStyle = grad;
      ctx.lineTo(getX(count - 1), priceHeight);
      ctx.lineTo(getX(0), priceHeight);
      ctx.closePath();
      ctx.fill();
    }

    // 10. 이동평균선 오버레이 (5, 20, 60, 120)
    if (showMA) {
      const maLines = [
        { data: maData.ma5, color: "#059669", width: 1.3 }, // 초록
        { data: maData.ma20, color: "#f43f5e", width: 1.3 }, // 빨강
        { data: maData.ma60, color: "#d97706", width: 1.3 }, // 주황
        { data: maData.ma120, color: "#7c3aed", width: 1.3 }, // 보라
      ];

      maLines.forEach(({ data, color, width }) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < count; i++) {
          const val = data[i];
          if (val === null) continue;
          const x = getX(i);
          const y = priceToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });
    }

    // 11. 최고가 / 최저가 어노테이션 및 화살표
    if (extremes) {
      // 최고점 (빨간색 화살표 ↓)
      const maxX = getX(extremes.maxIdx);
      const maxY = priceToY(extremes.maxVal);
      const maxText = `${formatPrice(extremes.maxVal)}원 (${extremes.maxChangePercent > 0 ? "+" : ""}${extremes.maxChangePercent.toFixed(2)}%, ${extremes.maxDate})`;

      ctx.fillStyle = "#f04452";
      ctx.strokeStyle = "#f04452";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = maxX > chartWidth * 0.75 ? "right" : maxX < chartWidth * 0.25 ? "left" : "center";
      ctx.textBaseline = "bottom";

      ctx.fillText(maxText, maxX, maxY - 12);
      ctx.beginPath();
      ctx.moveTo(maxX, maxY - 3);
      ctx.lineTo(maxX - 3, maxY - 9);
      ctx.lineTo(maxX + 3, maxY - 9);
      ctx.closePath();
      ctx.fill();

      // 최저점 (파란색 화살표 ↑)
      const minX = getX(extremes.minIdx);
      const minY = priceToY(extremes.minVal);
      const minText = `${formatPrice(extremes.minVal)}원 (${extremes.minChangePercent > 0 ? "+" : ""}${extremes.minChangePercent.toFixed(2)}%, ${extremes.minDate})`;

      ctx.fillStyle = "#3182f6";
      ctx.strokeStyle = "#3182f6";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = minX > chartWidth * 0.75 ? "right" : minX < chartWidth * 0.25 ? "left" : "center";
      ctx.textBaseline = "top";

      ctx.beginPath();
      ctx.moveTo(minX, minY + 3);
      ctx.lineTo(minX - 3, minY + 9);
      ctx.lineTo(minX + 3, minY + 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(minText, minX, minY + 12);
    }

    // 12. 현재가 기준 점선 & 우측 Y축 가격 뱃지
    const latestPoint = points[points.length - 1];
    const currentPrice = latestPoint.close;
    const currentY = Math.round(priceToY(currentPrice));
    const isCurrentUp = currentPrice >= (latestPoint.open ?? currentPrice);
    const badgeColor = isCurrentUp ? "#f04452" : "#3182f6";

    // 가로 점선
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(chartWidth, currentY);
    ctx.stroke();
    ctx.restore();

    // 우측 Y축 현재가 뱃지
    ctx.fillStyle = badgeColor;
    const badgeH = 18;
    const badgeY = currentY - badgeH / 2;
    ctx.fillRect(chartWidth, badgeY, rightAxisWidth, badgeH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatPrice(currentPrice), chartWidth + rightAxisWidth / 2, currentY);

    // 거래량 현재 뱃지
    if (showVolume) {
      const curVol = latestPoint.volume ?? 0;
      ctx.fillStyle = badgeColor;
      ctx.fillRect(chartWidth, totalContentHeight - 18, rightAxisWidth, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatVolume(curVol), chartWidth + rightAxisWidth / 2, totalContentHeight - 9);
    }

    // 13. 마우스 호버 / 터치 십자선 (Crosshair)
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < count) {
      const hPoint = points[hoverIndex];
      const hX = Math.round(getX(hoverIndex));
      const hY = Math.round(priceToY(hPoint.close));

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 1;

      // 수직선
      ctx.beginPath();
      ctx.moveTo(hX, 0);
      ctx.lineTo(hX, currentHeight);
      ctx.stroke();

      // 수평선
      ctx.beginPath();
      ctx.moveTo(0, hY);
      ctx.lineTo(chartWidth, hY);
      ctx.stroke();
      ctx.restore();

      // X축 호버 뱃지
      const xLabel = formatDateLabel(hPoint.date, false);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(hX - 35, totalContentHeight + 2, 70, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(xLabel, hX, totalContentHeight + 11);

      // Y축 호버 뱃지
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(chartWidth, hY - 9, rightAxisWidth, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatPrice(hPoint.close), chartWidth + rightAxisWidth / 2, hY);
    }
  }, [points, maData, extremes, showMA, showVolume, chartType, hoverIndex]);

  // 창 크기 변경 및 데이터 변경 시 다시 그리기
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const handleResize = () => drawChart();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawChart]);

  // 마우스/터치 인터랙션
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !points || points.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rightAxisWidth = 68;
    const chartWidth = rect.width - rightAxisWidth;
    const x = e.clientX - rect.left;

    if (x < 0 || x > chartWidth) {
      setHoverIndex(null);
      return;
    }

    const step = chartWidth / points.length;
    const idx = Math.min(points.length - 1, Math.max(0, Math.floor(x / step)));
    setHoverIndex(idx);
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = useMemo(() => {
    if (!points || points.length === 0) return null;
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length) {
      return points[hoverIndex];
    }
    return points[points.length - 1];
  }, [points, hoverIndex]);

  const activeIndex = hoverIndex ?? (points ? points.length - 1 : 0);

  if (error) {
    return (
      <div
        className="placeholder-box"
        data-testid="price-chart"
        style={{
          height,
          backgroundColor: "#ffffff",
          color: "#ef4444",
          borderRadius: 14,
          border: "1px solid #e6e4ef",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {error}
      </div>
    );
  }

  if (!points) {
    return (
      <div
        className="skeleton"
        data-testid="price-chart"
        style={{
          height,
          backgroundColor: "#ffffff",
          borderRadius: 14,
          border: "1px solid #e6e4ef",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#85859a",
          fontSize: 13,
        }}
      >
        차트 데이터를 불러오는 중…
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        className="placeholder-box"
        data-testid="price-chart"
        style={{
          height,
          backgroundColor: "#ffffff",
          color: "#85859a",
          borderRadius: 14,
          border: "1px solid #e6e4ef",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {range === "1일" ? "장 시작 전이거나 휴장일이라 분봉이 없어요" : "표시할 가격 데이터가 없어요"}
      </div>
    );
  }

  const activeUp = activePoint ? activePoint.close >= (activePoint.open ?? activePoint.close) : true;
  const activeColor = activeUp ? "#f04452" : "#3182f6";

  const chartContent = (
    <div
      ref={containerRef}
      data-testid="price-chart"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        color: "#17171f",
        borderRadius: isFullscreen ? 0 : 14,
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        right: isFullscreen ? 0 : undefined,
        bottom: isFullscreen ? 0 : undefined,
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : height,
        zIndex: isFullscreen ? 9999 : 1,
        border: isFullscreen ? "none" : "1px solid #e6e4ef",
        boxShadow: isFullscreen ? "none" : "0 2px 10px rgba(0,0,0,0.05)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. 상단 툴바 (주기 선택, 지표 토글, 차트 모양) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #ebeaf2",
          backgroundColor: "#fafafc",
          fontSize: 12,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {/* 주기 선택 (1분/1일, 1주, 1개월, 1년) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {RANGES.map((label) => {
            const active = label === range;
            return (
              <button
                key={label}
                onClick={() => onRangeChange?.(label)}
                style={{
                  padding: "4px 9px",
                  borderRadius: 6,
                  fontWeight: active ? 700 : 500,
                  backgroundColor: active ? "#ede9fe" : "transparent",
                  color: active ? "#6d28d9" : "#64748b",
                  border: active ? "1px solid #ddd6fe" : "1px solid transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "all 0.15s ease",
                }}
              >
                {label === "1일" ? "1분" : label.replace("1", "")}
              </button>
            );
          })}
        </div>

        {/* 차트 스타일 & 보조지표 제어 도구 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* 봉/라인 전환 */}
          <button
            onClick={() => setChartType(chartType === "candle" ? "line" : "candle")}
            title="차트 형태 변경"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: "#f1f3f7",
              color: "#374151",
              border: "1px solid #e2e5ec",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {chartType === "candle" ? "봉차트" : "라인차트"}
          </button>

          {/* 이동평균선 토글 */}
          <button
            onClick={() => setShowMA(!showMA)}
            title="이동평균선 표시/숨김"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: showMA ? "rgba(16, 185, 129, 0.12)" : "#f1f3f7",
              border: showMA ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #e2e5ec",
              color: showMA ? "#059669" : "#6b7280",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            이평선 {showMA ? "ON" : "OFF"}
          </button>

          {/* 거래량 토글 */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            title="거래량 표시/숨김"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: showVolume ? "rgba(2, 132, 199, 0.12)" : "#f1f3f7",
              border: showVolume ? "1px solid rgba(2, 132, 199, 0.3)" : "1px solid #e2e5ec",
              color: showVolume ? "#0284c7" : "#6b7280",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            거래량 {showVolume ? "ON" : "OFF"}
          </button>

          {/* 전체화면 버튼 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="전체화면"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              backgroundColor: "#f1f3f7",
              border: "1px solid #e2e5ec",
              color: "#374151",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {isFullscreen ? "✕" : "⤢"}
          </button>
        </div>
      </div>

      {/* 2. 상단 정보 바 (시작, 고가, 저가, 종가, 거래량, 이동평균선 범례) */}
      <div
        style={{
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: "1px solid #f1f2f7",
          backgroundColor: "#ffffff",
          fontSize: 11.5,
        }}
      >
        {/* OHLC 정보 */}
        {activePoint && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: "#85859a" }}>
              일시: <strong style={{ color: "#17171f" }}>{formatDateLabel(activePoint.date)}</strong>
            </span>
            <span>
              시: <strong style={{ color: activeColor }}>{formatPrice(activePoint.open ?? activePoint.close)}</strong>
            </span>
            <span>
              고: <strong style={{ color: activeColor }}>{formatPrice(activePoint.high ?? activePoint.close)}</strong>
            </span>
            <span>
              저: <strong style={{ color: activeColor }}>{formatPrice(activePoint.low ?? activePoint.close)}</strong>
            </span>
            <span>
              종: <strong style={{ color: activeColor }}>{formatPrice(activePoint.close)}</strong>
            </span>
            {showVolume && activePoint.volume !== undefined && (
              <span style={{ color: "#85859a" }}>
                거래량: <strong style={{ color: "#0284c7" }}>{formatVolume(activePoint.volume)}</strong>
              </span>
            )}
          </div>
        )}

        {/* 이동평균선 수치 범례 (5: 초록, 20: 빨강, 60: 주황, 120: 보라) */}
        {showMA && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ color: "#85859a" }}>이평선</span>
            <span style={{ color: "#059669", fontWeight: 600 }}>
              5 {maData.ma5[activeIndex] ? formatPrice(Math.round(maData.ma5[activeIndex]!)) : "-"}
            </span>
            <span style={{ color: "#f43f5e", fontWeight: 600 }}>
              20 {maData.ma20[activeIndex] ? formatPrice(Math.round(maData.ma20[activeIndex]!)) : "-"}
            </span>
            <span style={{ color: "#d97706", fontWeight: 600 }}>
              60 {maData.ma60[activeIndex] ? formatPrice(Math.round(maData.ma60[activeIndex]!)) : "-"}
            </span>
            <span style={{ color: "#7c3aed", fontWeight: 600 }}>
              120 {maData.ma120[activeIndex] ? formatPrice(Math.round(maData.ma120[activeIndex]!)) : "-"}
            </span>
          </div>
        )}
      </div>

      {/* 3. 캔버스 영역 */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
      </div>
    </div>
  );

  return chartContent;
}
