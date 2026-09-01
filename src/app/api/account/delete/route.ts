import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 계정 탈퇴. Supabase 클라이언트 SDK는 "내 계정 삭제"를 anon 키로 노출하지 않아서(관리자
 * 권한 필요), 여기서 먼저 로그인 세션을 검증한 다음 서비스 롤 키로 auth.admin.deleteUser를
 * 호출한다.
 *
 * 세션 검증엔 getSession()이 아니라 반드시 getUser()를 쓴다 — getSession()은 쿠키에 담긴
 * JWT를 서버 재검증 없이 그대로 읽기만 해서, 위조된 쿠키로도 통과할 수 있다는 게 Supabase
 * 공식 경고다(src/lib/supabase/middleware.ts와 동일한 이유).
 *
 * profiles / watchlist_items는 auth.users(id)를 `on delete cascade`로 참조하도록 스키마를
 * 만들어뒀기 때문에, auth 사용자만 지우면 두 테이블 행은 별도 삭제 없이 자동으로 같이 지워진다.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.warn("[account] 탈퇴 실패:", error);
      return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[account] 탈퇴 처리 중 오류:", error);
    const message = error instanceof Error ? error.message : "탈퇴 처리 중 오류가 발생했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
