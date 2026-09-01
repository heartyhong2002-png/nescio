import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 구글/카카오 로그인 콜백. signInWithOAuth()가 provider 인증을 마치고 여기(?code=...)로
 * 돌아온다. PKCE 플로우라 code를 세션으로 교환해야 하는데, 이건 반드시 서버에서 해야 한다
 * (code_verifier가 서버 쿠키에 저장돼 있어서 브라우저 단독으로는 교환 불가능).
 *
 * 이메일 로그인 페이지(onboarding/login/page.tsx)와 동일한 온보딩 여부 분기를 여기서도
 * 반복한다 — 이미 온보딩을 마친 재방문 유저는 홈으로, 신규 유저(또는 아직 온보딩 전인 유저)는
 * 온보딩으로 보낸다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/onboarding/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn("[auth] OAuth 콜백 코드 교환 실패:", error);
    return NextResponse.redirect(`${origin}/onboarding/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/onboarding/login?error=oauth`);
  }

  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).single();
  return NextResponse.redirect(`${origin}${profile?.onboarded ? "/" : "/onboarding/persona"}`);
}
