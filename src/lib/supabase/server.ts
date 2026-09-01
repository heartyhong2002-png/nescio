import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(Server Component / Route Handler / Server Action)에서 쓰는 Supabase 클라이언트.
 * 요청마다 새로 만들어야 한다(쿠키가 요청별로 다르므로 client.ts처럼 싱글턴으로 캐시하면 안 됨).
 *
 * setAll이 Server Component 렌더 도중 호출되면 Next.js가 에러를 던진다(렌더 중엔 쿠키를 못
 * 쓰기 때문) — 이 프로젝트는 지금 서버 컴포넌트에서 직접 데이터를 페칭하는 곳이 없어서 당장
 * 영향은 없지만, 나중에 실수로 부딪혀도 앱이 죽지 않도록 방어적으로 try/catch로 감싼다. 실제
 * 세션 쿠키 갱신은 src/proxy.ts + src/lib/supabase/middleware.ts가 매 요청마다 처리한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  // client.ts와 동일한 이유로 값이 없으면 더미로 대체 — 실제 호출 시 네트워크 단계에서
  // 실패하게 미룬다(생성 시점에 throw해서 이 함수를 쓰는 라우트 전체가 죽는 것보다 낫다).
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component 렌더 중 호출된 경우 — 무시해도 안전(세션 갱신은 proxy가 담당).
          }
        },
      },
    },
  );
}
