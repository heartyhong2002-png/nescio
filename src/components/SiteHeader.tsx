"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/storage";

const NAV = [
  { href: "/", label: "브리핑" },
  { href: "/watchlist/add", label: "관심종목 담기" },
  { href: "/ipo", label: "공모주" },
  { href: "/exchange-rates", label: "환율" },
  { href: "/alerts", label: "알림" },
  { href: "/my", label: "마이" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!loading && (
            user ? (
              <Link
                href="/my"
                style={{
                  fontSize: 12.5,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span>☁️</span>
                <span>{user.email.split("@")[0]}</span>
              </Link>
            ) : (
              <Link
                href="/onboarding/login"
                className="btn btn-primary"
                style={{
                  fontSize: 12.5,
                  padding: "6px 14px",
                  borderRadius: 8,
                  height: "auto",
                  minHeight: "unset",
                }}
              >
                로그인
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
