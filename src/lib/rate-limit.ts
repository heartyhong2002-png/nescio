// 아주 단순한 IP별 고정 윈도우 레이트리밋.
//
// 한계: 서버리스(Vercel)에서는 라우트/인스턴스마다 메모리가 따로 돌아서 완벽한 차단은 안 된다
// (kis.ts의 토큰 캐시와 같은 제약). 그래도 같은 웜 인스턴스를 반복 호출하는 스크립트나 무심코
// 새로고침을 연타하는 경우는 확실히 막아준다 — 비용이 드는 LLM 호출(analyze, valuation/interpret)
// 에 대해 "아예 없는 것보다 훨씬 나은" 수준의 방어선. 더 강한 보장이 필요해지면 Vercel
// KV/Upstash 같은 공유 스토어로 옮겨야 한다.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// 버킷이 무한히 쌓이지 않도록 가끔 만료된 것들을 정리한다.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;
function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** 요청 헤더에서 클라이언트 IP를 뽑는다. Vercel은 x-forwarded-for를 항상 채워준다. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * key(보통 "라우트이름:IP")당 windowMs 동안 limit번까지만 허용한다.
 * 허용되면 true, 초과했으면 false를 반환한다.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, retryAfterMs: 0 };
}
