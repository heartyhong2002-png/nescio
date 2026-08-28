"use client";

import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import BottomNav from "./BottomNav";

/**
 * 앱 공통 크롬: 데스크톱은 상단 가로 내비게이션, 모바일은 하단 탭바.
 * - `narrow`: 본문을 읽기 좋은 좁은 폭으로 제한
 * - `bare`: 내비게이션 없이 본문만 (온보딩 중 관심종목 담기처럼 집중 플로우일 때)
 */
export default function AppShell({
  children,
  narrow,
  bare,
}: {
  children: ReactNode;
  narrow?: boolean;
  bare?: boolean;
}) {
  return (
    <div className="page">
      {!bare && <SiteHeader />}
      <main className={`app-main${bare ? "" : " with-bottom-nav"}${narrow ? " narrow" : ""}`}>{children}</main>
      {!bare && <BottomNav />}
    </div>
  );
}
