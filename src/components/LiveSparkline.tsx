"use client";

import { useEffect, useRef } from "react";

export type LiveSparklineProps = {
  /** 최신 시세 */
  value: number;
  /** 등락률 계산 기준값(보통 전일 종가). 트레이스 색·기준선을 결정 */
  referenceValue: number;
  width?: number;
  height?: number;
  /** 화면에 보이는 시간 폭(ms). 기본 12초치 트레이스가 흘러간다. */
  windowMs?: number;
  /** 등락률이 이 값(%)만큼 벌어지면 트레이스가 카드 위/아래 끝에 닿는다. */
  maxDeviationPct?: number;
  className?: string;
};

/**
 * 관심종목 카드용 실시간 등락률 트레이스 ("지진계" 스타일).
 * 실제 지진계 펜과 같은 원리로 그린다 — 시세가 실제로 움직이면(target 변화) 그 순간
 * "파동"이 한 번 발생해 감쇠 진동(exp(-t)·cos(t))하며 잦아들고, 값이 안 움직이는 동안도
 * 배경 미진(microseism)처럼 잔잔한 파동이 불규칙하게 섞여 계속 기록 중인 느낌을 준다.
 * `--up`/`--down`(globals.css)을 그대로 사용해 이 프로젝트의 등락 색 규약과 맞춘다.
 */
export function LiveSparkline({
  value,
  referenceValue,
  width = 64,
  height = 28,
  windowMs = 12000,
  maxDeviationPct = 1.2,
  className,
}: LiveSparklineProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const leadRef = useRef<SVGCircleElement>(null);
  const targetRef = useRef(0);

  const pct = referenceValue ? ((value - referenceValue) / referenceValue) * 100 : 0;
  const trend = pct >= 0.005 ? "up" : pct <= -0.005 ? "down" : "flat";
  const color = trend === "up" ? "var(--up)" : trend === "down" ? "var(--down)" : "var(--muted)";

  useEffect(() => {
    const halfRange = height / 2 - 4;
    targetRef.current = Math.max(-halfRange, Math.min(halfRange, (pct / maxDeviationPct) * halfRange));
  }, [pct, maxDeviationPct, height]);

  // rAF 엔진 — mount 시 한 번만 시작하고, 그 이후로는 targetRef만 읽어서 부드럽게 따라간다.
  // (매 프레임 React state를 갱신하면 렌더 비용이 커지므로 DOM을 직접 조작한다.)
  useEffect(() => {
    const path = pathRef.current;
    const lead = leadRef.current;
    if (!path || !lead) return;

    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    const pxPerMs = width / windowMs;
    let worldX = 0;
    // baseline: 실제 등락률 추세를 따라가는 "느린" 성분 (지진계 펜의 평균 위치)
    let baseline = 0;
    let lastTargetSeen = targetRef.current;
    let lastFrame: number | null = null;
    let sinceSample = 0;
    let ambientTimer = 0;
    // events: 실제 지진계처럼 "파동"이 한 번 치고 지수적으로 감쇠 진동하며 잦아드는 충격.
    // 시세가 실제로 움직일 때(target 변화)와, 배경 미진(ambient microseism)일 때 둘 다 여기 쌓인다.
    type QuakeEvent = { t: number; amp: number; freq: number; decay: number };
    const events: QuakeEvent[] = [];
    const points: { x: number; y: number }[] = [];
    let raf = 0;

    function frame(ts: number) {
      if (lastFrame == null) lastFrame = ts;
      const dt = Math.min(100, ts - lastFrame);
      lastFrame = ts;
      worldX += dt * pxPerMs;

      // 추세 자체는 스무스하게(펜이 서서히 새 기준선으로 이동)
      baseline += (targetRef.current - baseline) * Math.min(1, dt / 900);

      if (!reducedMotion) {
        // 시세가 실제로 움직였으면 그 크기만큼 "지진파" 한 번 발생 — 급격히 튀었다가
        // 감쇠 진동하며 가라앉는다(실제 지진계 임펄스 응답과 같은 모양).
        const jump = targetRef.current - lastTargetSeen;
        if (Math.abs(jump) > 0.35) {
          events.push({
            t: ts,
            amp: Math.max(-9, Math.min(9, jump * 1.6)),
            freq: 0.045 + Math.random() * 0.025,
            decay: 0.0026 + Math.random() * 0.0012,
          });
        }
        lastTargetSeen = targetRef.current;

        // 배경 미진(microseism) — 가격이 안 움직여도 지진계는 계속 잔잔하게 떤다.
        ambientTimer += dt;
        if (ambientTimer > 260 + Math.random() * 420) {
          ambientTimer = 0;
          if (Math.random() < 0.4) {
            events.push({
              t: ts,
              amp: (Math.random() - 0.5) * 2.6,
              freq: 0.05 + Math.random() * 0.035,
              decay: 0.004 + Math.random() * 0.003,
            });
          }
        }
        while (events.length && ts - events[0].t > 2600) events.shift();
      }

      // 모든 파동을 합성 — 감쇠 사인파 여러 개가 겹쳐서 뾰족뾰족한 지진계 특유의 모양이 됨
      let seismic = 0;
      for (const e of events) {
        const age = ts - e.t;
        seismic += e.amp * Math.exp(-age * e.decay) * Math.cos(age * e.freq);
      }
      const hiss = reducedMotion ? 0 : (Math.random() - 0.5) * 0.3;

      sinceSample += dt;
      if (sinceSample >= 16) {
        sinceSample = 0;
        const y = height / 2 - baseline - seismic - hiss;
        points.push({ x: worldX, y });
        const minX = worldX - width - 20;
        while (points.length && points[0].x < minX) points.shift();
      }

      if (points.length > 1 && path && lead) {
        let d = "";
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const sx = p.x - (worldX - width);
          const sy = Math.max(2, Math.min(height - 2, p.y));
          d += (i === 0 ? "M" : "L") + sx.toFixed(1) + " " + sy.toFixed(1) + " ";
        }
        path.setAttribute("d", d);
        const lastY = Math.max(2, Math.min(height - 2, points[points.length - 1].y));
        lead.setAttribute("cx", String(width - 1));
        lead.setAttribute("cy", String(lastY));
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
    // width/height/windowMs가 바뀌면 좌표계가 달라지므로 엔진을 다시 만든다.
  }, [width, height, windowMs]);

  return (
    <div className={className} style={{ width, height, position: "relative", flexShrink: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: "block", overflow: "hidden" }}>
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--line)"
          strokeWidth={1}
          strokeDasharray="1.5,3"
        />
        <path ref={pathRef} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <circle ref={leadRef} r={2.4} fill={color} />
      </svg>
    </div>
  );
}
