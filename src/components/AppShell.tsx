"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useWatchlist } from "@/lib/storage";
import SiteHeader from "./SiteHeader";
import BottomNav from "./BottomNav";

const INTELLIGENCE_NAV = [
  { href: "/", label: "브리핑", icon: "grid" },
  { href: "/stock", label: "종목 분석", icon: "chart" },
  { href: "/watchlist/add", label: "관심종목", icon: "star" },
  { href: "/ipo", label: "공모주", icon: "calendar" },
  { href: "/exchange-rates", label: "글로벌", icon: "globe" },
  { href: "/alerts", label: "알림", icon: "bell" },
] as const;

function WorkspaceIcon({ name }: { name: (typeof INTELLIGENCE_NAV)[number]["icon"] }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  };

  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function IntelligenceSidebar() {
  const pathname = usePathname();
  const { watchlist } = useWatchlist();
  const { user, loading } = useAuth();
  const firstStock = watchlist[0] ?? { ticker: "005930", name: "삼성전자" };
  const stockHref = `/stock/${firstStock.ticker}?name=${encodeURIComponent(firstStock.name)}`;

  return (
    <aside className="workspace-sidebar" aria-label="주요 메뉴">
      <Link href="/" className="workspace-brand" aria-label="nescio 브리핑 홈">
        <span className="workspace-brand-mark" aria-hidden="true"><i /><b /></span>
        <span>nescio<small>MARKET INTELLIGENCE</small></span>
      </Link>

      <div className="workspace-nav-caption">WORKSPACE</div>
      <nav className="workspace-nav">
        {INTELLIGENCE_NAV.map((item) => {
          const href = item.href === "/stock" ? stockHref : item.href;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={href} className={`workspace-nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <WorkspaceIcon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "관심종목" && watchlist.length > 0 && <span className="workspace-nav-count">{watchlist.length}</span>}
            </Link>
          );
        })}
      </nav>

      <Link href="/alerts" className="workspace-brief-link">
        <span className="workspace-brief-icon" aria-hidden="true">✳</span>
        <span className="workspace-brief-eyebrow">MARKET SIGNAL</span>
        <strong>관심종목의 변동을<br />놓치지 마세요</strong>
        <span className="workspace-brief-action">가격 알림 확인 <span aria-hidden="true">→</span></span>
      </Link>

      <Link href="/my" className="workspace-profile">
        <span className="workspace-avatar" aria-hidden="true">{user?.email?.slice(0, 1).toUpperCase() ?? "N"}</span>
        <span className="workspace-profile-copy"><strong>{loading ? "계정 확인 중" : user?.email?.split("@")[0] ?? "내 계정"}</strong><small>{user ? "개인 투자자" : "로그인 및 설정"}</small></span>
        <span className="workspace-profile-chevron" aria-hidden="true">›</span>
      </Link>
    </aside>
  );
}

function IntelligenceTopbar() {
  return (
    <header className="workspace-topbar">
      <Link href="/watchlist/add" className="workspace-search" aria-label="종목을 검색해 관심종목에 추가">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <span>종목을 검색해 관심종목에 추가</span>
      </Link>
      <div className="workspace-topbar-actions">
        <span className="workspace-market-status"><i /> 국내 시장 데이터</span>
        <Link href="/alerts" className="workspace-icon-link" aria-label="알림">
          <WorkspaceIcon name="bell" />
          <i aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

/**
 * 앱 공통 크롬: 인텔리전스 화면은 데스크톱 사이드 내비게이션, 모바일은 하단 탭바.
 * - `narrow`: 본문을 읽기 좋은 좁은 폭으로 제한
 * - `bare`: 내비게이션 없이 본문만 (온보딩 중 관심종목 담기처럼 집중 플로우일 때)
 */
export default function AppShell({
  children,
  narrow,
  bare,
  variant = "default",
}: {
  children: ReactNode;
  narrow?: boolean;
  bare?: boolean;
  /** 시장 인텔리전스 화면의 공통 다크 레이아웃에 적용한다. */
  variant?: "default" | "intelligence";
}) {
  return (
    <div className={`page${variant === "intelligence" ? " intelligence-page" : ""}`}>
      {!bare && variant === "intelligence" && <IntelligenceSidebar />}
      {!bare && variant === "intelligence" && <IntelligenceTopbar />}
      {!bare && variant === "default" && <SiteHeader />}
      <main className={`app-main${bare ? "" : " with-bottom-nav"}${narrow ? " narrow" : ""}`}>{children}</main>
      {!bare && <BottomNav variant={variant} />}
    </div>
  );
}
