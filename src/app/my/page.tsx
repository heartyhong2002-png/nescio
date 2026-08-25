"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth, useWatchlist } from "@/lib/storage";

export default function MyPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { watchlist } = useWatchlist();
  const [notifyOn, setNotifyOn] = useState(true);

  function handleLogout() {
    logout();
    router.push("/onboarding");
  }

  return (
    <main className="page with-bottom-nav">
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="topbar">
          <div className="title-md">마이</div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            계정
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.email ?? "로그인이 필요해요"}</div>
        </div>

        <div className="section-title">알림 설정</div>
        <button className="option-row" style={{ width: "100%", marginBottom: 24 }} onClick={() => setNotifyOn((v) => !v)}>
          <div>
            <div className="option-title">새 브리핑 알림</div>
            <div className="option-desc">관심종목에 뉴스가 도착하면 알려드려요</div>
          </div>
          <span className={`pill ${notifyOn ? "filled" : ""}`}>{notifyOn ? "켜짐" : "꺼짐"}</span>
        </button>

        <div className="section-title">관심종목</div>
        <Link href="/watchlist/add" className="option-row" style={{ marginBottom: 24 }}>
          <div>
            <div className="option-title">관심종목 관리</div>
            <div className="option-desc">현재 {watchlist.length}개 담김</div>
          </div>
          <span className="muted">→</span>
        </Link>

        <div className="section-title">투자 성향</div>
        <Link href="/onboarding/persona" className="option-row" style={{ marginBottom: 24 }}>
          <div>
            <div className="option-title">투자 성향 재설정</div>
            <div className="option-desc">브리핑 깊이와 말투를 다시 맞춰요</div>
          </div>
          <span className="muted">→</span>
        </Link>

        <button className="btn btn-secondary btn-block" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      <BottomNav />
    </main>
  );
}
