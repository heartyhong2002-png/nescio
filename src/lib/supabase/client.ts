"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저(클라이언트 컴포넌트)에서 쓰는 Supabase 클라이언트.
 * 여러 곳에서 호출해도 안전하다고 공식 문서에 명시돼 있음 — 그래도 모듈 레벨에서 한 번만
 * 만들어서 재사용한다(호출할 때마다 새로 만들 이유가 없음).
 *
 * NEXT_PUBLIC_ 환경변수는 빌드 시 클라이언트 번들에 정적으로 인라인되기 때문에, 다른 서버
 * 전용 키들과 달리 lib/server-env.ts의 serverEnv() 래퍼(notebooks/.env 런타임 폴백)를 거치지
 * 않고 process.env로 직접 읽는다 — 그 래퍼는 클라이언트 번들 코드엔 안 먹힌다.
 *
 * 타입은 `ReturnType<typeof createBrowserClient>`로 뽑지 않고 SupabaseClient를 명시한다 —
 * createBrowserClient가 오버로드 시그니처 2개(신규/deprecated)를 갖고 있어서 ReturnType이
 * 조용히 `any`로 뭉개지는 TS 이슈가 있음(직접 확인함 — 이대로 두면 .auth.getSession() 같은
 * 호출의 콜백 인자가 전부 암묵적 any가 돼서 noImplicitAny 에러가 남).
 *
 * env var가 비어있으면 createBrowserClient가 그 자리에서 바로 throw한다 — 이 provider는
 * 루트 layout에서 앱 전체를 감싸고 있어서, 그대로 두면 `next build`가 정적 페이지를
 * 프리렌더링하는 도중(예: /_not-found) 이 에러 때문에 빌드 자체가 죽어버린다(다른 API
 * 키들처럼 요청 시점에만 에러가 나는 게 아니라). 그래서 값이 없을 때는 더미 URL/키로 대신
 * 생성해 빌드는 통과시키고, 실제 로그인 시도 시 네트워크 요청이 실패하는 형태로 미룬다 —
 * getSession()/signInWithPassword() 등은 네트워크 실패를 throw 없이 error 객체로 돌려주는
 * SDK라 이 경우도 크래시 없이 "로그인 안 됨" 상태로 조용히 처리된다.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 설정되지 않았어요. " +
      "로그인·관심종목 저장이 동작하지 않습니다 — README의 Supabase 설정 섹션을 참고하세요.",
  );
}

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      SUPABASE_URL || "https://placeholder.supabase.co",
      SUPABASE_PUBLISHABLE_KEY || "placeholder-key",
    );
  }
  return browserClient;
}
