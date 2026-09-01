import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * src/proxy.ts에서 매 요청마다 호출 — Supabase 세션 쿠키를 갱신(refresh)한다.
 *
 * 반드시 supabase.auth.getUser()를 써야 한다 — getSession()이 아니다. getSession()은 쿠키에 든
 * JWT를 서버에 검증 요청 없이 그냥 읽기만 해서, 만료되었거나 위조된 세션도 그대로 통과시킬 수
 * 있다(Supabase 공식 문서가 "Proxy 같은 서버 코드에서 getSession()을 신뢰하지 말라"고 명시적으로
 * 경고하는 부분). getUser()는 Supabase 인증 서버에 왕복 검증을 해서 실제로 유효한 세션인지
 * 확인한다. (반대로 클라이언트 쪽 auth-context.tsx에서 getSession()/onAuthStateChange를 쓰는 건
 * 별개 — 브라우저 SDK가 로컬에서 이미 검증/관리하는 세션이라 이 경고 대상이 아니다.)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // 이 proxy는 사실상 모든 경로에서 매 요청마다 실행된다 — env var가 비어있는데
  // createServerClient가 그 자리에서 throw하게 두면 Supabase를 설정하기 전까지 앱의 모든
  // 페이지가 500으로 죽는다. 설정 전에는 그냥 세션 갱신을 건너뛴다(로그인 기능만 안 될 뿐,
  // 나머지 페이지는 정상 동작).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // 세션 갱신만 목적 — 여기서 리다이렉트는 하지 않는다(§3 참고: 서버 사이드 라우트 보호는
  // 이번 스코프 밖, 지금처럼 클라이언트 컴포넌트가 리다이렉트 UX를 그대로 담당).
  await supabase.auth.getUser();

  return supabaseResponse;
}
