import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16에서 middleware.ts가 proxy.ts로 이름이 바뀌었다(AGENTS.md가 경고하는 breaking
// change 중 하나 — node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// 확인 완료). src/app과 같은 레벨(src/proxy.ts)에 둬야 인식된다.

// ---------------------------------------------------------------------------
// 서버 사이드 라우트 보호
// ---------------------------------------------------------------------------

// 로그인해야만 볼 수 있는 페이지 경로. 비로그인이면 /onboarding/login으로 리다이렉트.
const PROTECTED_PAGES = ["/my", "/watchlist", "/alerts"];

// 이미 로그인된 사용자가 방문하면 홈(/)으로 보내는 "게스트 전용" 페이지.
// 재설정 메일 링크 타고 온 update-password는 세션이 자동 생성되므로 예외.
const GUEST_ONLY_PAGES = ["/onboarding/login", "/onboarding/reset-password"];

function isProtected(pathname: string) {
  return PROTECTED_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function isGuestOnly(pathname: string) {
  return GUEST_ONLY_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 보호 경로: 비로그인이면 로그인 페이지로
  if (!user && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/onboarding/login";
    return NextResponse.redirect(loginUrl);
  }

  // 게스트 전용 경로: 이미 로그인됐으면 홈으로
  if (user && isGuestOnly(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  // 정적 자산·이미지 최적화 경로는 제외 — 안 그러면 CSS/JS/이미지 로딩마다 불필요하게
  // Supabase 세션 갱신 요청이 걸린다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
