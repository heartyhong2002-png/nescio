"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "브리핑" },
  { href: "/watchlist/add", label: "관심종목 담기" },
  { href: "/exchange-rates", label: "환율" },
  { href: "/alerts", label: "알림" },
  { href: "/my", label: "마이" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <span className="site-brand-dot" />
          nescio
        </Link>
        <nav className="site-nav">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <span className="site-header-cta">관심 종목 뉴스 맥락 브리핑</span>
      </div>
    </header>
  );
}
