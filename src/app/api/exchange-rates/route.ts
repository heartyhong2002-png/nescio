import { NextResponse } from "next/server";
import { fetchLatestExchangeRates } from "@/lib/exim";

// 한국수출입은행 API가 해외(비한국) IP로 보이는 요청을 방화벽 단에서 끊는 것으로 보여
// (ECONNRESET), 이 함수는 서울 리전에서 실행되도록 지정한다. Vercel Hobby 플랜에서는
// 프로젝트 Settings → Functions → Function Region 설정이 우선 적용되니, 거기서도
// "Seoul, South Korea (icn1)"로 맞춰줘야 한다.
export const preferredRegion = "icn1";

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
