import { NextResponse } from "next/server";
import { fetchLatestExchangeRates } from "@/lib/exim";

// 한국수출입은행 API가 해외(비한국) IP로 보이는 요청을 방화벽 단에서 끊는 문제(ECONNRESET)가
// 있었는데, 이 Next.js 버전에서는 `preferredRegion`에 구체적인 리전 코드('icn1' 등)를 더 이상
// 못 쓴다(deprecated — Vercel에서 'auto'/'global'/'home'만 허용). 그래서 리전 지정은 코드가 아니라
// Vercel 대시보드 Settings → Functions → Function Region을 "Seoul, South Korea (icn1)"로
// 맞추는 것으로 처리한다(실제로 이걸로 ECONNRESET은 해결됨).
export async function GET() {
  try {
    const { date, rates } = await fetchLatestExchangeRates();
    const sorted = [...rates].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return NextResponse.json({ date, rates: sorted, count: sorted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "환율 정보를 불러오지 못했습니다.";
    // 원인(예: TLS 인증서 체인 문제, 방화벽/WAF 차단 등)을 Vercel 함수 로그에서 확인할 수 있도록
    // cause까지 남긴다 — 클라이언트에는 짧은 메시지만 노출하고 상세 원인은 로그로만 남긴다.
    console.error(
      "[/api/exchange-rates] 환율 조회 실패:",
      error,
      error instanceof Error && error.cause ? { cause: error.cause } : "",
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
