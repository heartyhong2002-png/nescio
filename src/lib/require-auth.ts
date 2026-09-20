import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type RequireAuthOptions = {
  /**
   * true이면 AAL2(2단계 인증 검증 완료) 세션인지 추가로 확인한다.
   * 계정 삭제 같은 고위험 작업에 쓴다. MFA가 등록되지 않은 사용자에게는
   * 이 옵션이 있어도 AAL1 세션만으로 통과시킨다 — 등록하지 않은 사용자를
   * 차단하는 건 의도가 아니라, "등록은 했는데 2차 검증을 안 거친" 세션만 막는 것.
   */
  requireMfa?: boolean;
};

type AuthSuccess = { user: User; response: null };
type AuthFailure = { user: null; response: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * API 라우트 핸들러 안에서 로그인 여부(+ 선택적 MFA)를 검사하는 헬퍼.
 *
 * 사용법:
 * ```ts
 * const auth = await requireAuth();
 * if (auth.response) return auth.response;   // 401/403 자동 반환
 * const user = auth.user;                     // 여기부터 user는 반드시 존재
 * ```
 */
export async function requireAuth(options?: RequireAuthOptions): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }),
    };
  }

  if (options?.requireMfa) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // nextLevel이 aal2라는 건 "이 사용자는 TOTP를 등록해둬서 aal2까지 올라가야 한다"는 뜻.
    // currentLevel이 아직 aal1이면 2차 검증을 안 거친 세션이므로 차단한다.
    if (aalData && aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
      return {
        user: null,
        response: NextResponse.json(
          { error: "2단계 인증이 필요해요.", mfaRequired: true },
          { status: 403 },
        ),
      };
    }
  }

  return { user, response: null };
}
