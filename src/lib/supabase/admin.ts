import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server-env";

/**
 * 서비스 롤 키로 만든 관리자 권한 Supabase 클라이언트 — RLS를 완전히 우회한다.
 * 반드시 서버 전용 코드(API 라우트 등)에서만 import한다. "use client" 컴포넌트나 클라이언트
 * 번들에 들어가는 코드에서 이 파일을 import하면 서비스 롤 키가 브라우저에 노출된다.
 *
 * 지금은 계정 탈퇴(auth.admin.deleteUser) 용도로만 쓴다 — Supabase 클라이언트 SDK는 보안상
 * "내 계정 삭제"를 anon 키로 노출하지 않기 때문에, 서비스 롤 키를 가진 서버 쪽에서 대신
 * 호출해야 한다.
 *
 * SUPABASE_SERVICE_ROLE_KEY는 NEXT_PUBLIC_* 이 아니라 serverEnv()로 읽는다 — 클라이언트
 * 번들에 절대 인라인되면 안 되는 비밀 키라서 notebooks/.env(서버 전용, gitignore)에 둔다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = serverEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았어요. notebooks/.env에 추가하세요.");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
