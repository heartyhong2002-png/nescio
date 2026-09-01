"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider } from "@/lib/profile-context";
import { WatchlistProvider } from "@/lib/watchlist-context";

/**
 * layout.tsx는 서버 컴포넌트로 유지하고(metadata export 때문), 이 클라이언트 컴포넌트가
 * 인증/프로필/관심종목 상태를 앱 전체에 한 번만 구독해서 공급한다. 순서 중요 — Profile과
 * Watchlist는 Auth의 user를 필요로 한다.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WatchlistProvider>{children}</WatchlistProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
