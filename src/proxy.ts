import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16에서 middleware.ts가 proxy.ts로 이름이 바뀌었다(AGENTS.md가 경고하는 breaking
// change 중 하나 — node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// 확인 완료). src/app과 같은 레벨(src/proxy.ts)에 둬야 인식된다.
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 정적 자산·이미지 최적화 경로는 제외 — 안 그러면 CSS/JS/이미지 로딩마다 불필요하게
  // Supabase 세션 갱신 요청이 걸린다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
