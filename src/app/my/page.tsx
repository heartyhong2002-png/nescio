"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth, useWatchlist } from "@/lib/storage";

export default function MyPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { watchlist, loading: watchlistLoading } = useWatchlist();
  const [notifyOn, setNotifyOn] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleLogout() {
    await signOut();
    router.push("/onboarding");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error ?? "탈퇴 처리 중 오류가 발생했어요.");
        setDeleting(false);
        return;
      }
      // 계정은 서버에서 이미 삭제됐다 — 남은 로컬 세션(쿠키/토큰)도 정리한다. 실패해도
      // 무해하다(삭제된 계정의 토큰은 다음 요청부터 어차피 서버에서 거부되어 로그아웃
      // 상태로 취급됨).
      await signOut();
      router.push("/onboarding");
    } catch {
      setDeleteError("네트워크 오류로 탈퇴하지 못했어요. 다시 시도해주세요.");
      setDeleting(false);
    }
  }

  return (
    <AppShell narrow>
      <div className="topbar">
        <div className="page-title">마이</div>
      </div>

      <div className="card" style={{ marginBottom: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          계정
        </div>
        {authLoading ? (
          <div className="skeleton" style={{ height: 22, width: 160, borderRadius: 6 }} />
        ) : (
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {/* user.email이 빈 문자열일 수 있다(카카오 로그인은 email 동의항목 없이도 가입 가능
                — useAuth()가 그 경우 email을 ""로 채워서 내려줌). ?? 는 null/undefined만 잡고
                빈 문자열은 안 잡아서, 여기서 따로 처리 안 하면 계정 카드가 빈 줄로 보인다. */}
            {user ? user.email || "카카오 계정으로 로그인됨" : "로그인이 필요해요"}
          </div>
        )}
      </div>

      <div className="section-title">알림 설정</div>
      <button
        className="option-row"
        style={{ marginBottom: 26 }}
        onClick={() => setNotifyOn((v) => !v)}
      >
        <div>
          <div className="option-title">새 브리핑 알림</div>
          <div className="option-desc">관심종목에 뉴스가 도착하면 알려드려요</div>
        </div>
        <span className={`pill ${notifyOn ? "filled" : ""}`}>{notifyOn ? "켜짐" : "꺼짐"}</span>
      </button>

      <div className="section-title">관심종목</div>
      <Link href="/watchlist/add" className="option-row" style={{ marginBottom: 26 }}>
        <div>
          <div className="option-title">관심종목 관리</div>
          <div className="option-desc">현재 {watchlistLoading ? "…" : `${watchlist.length}개`} 담김</div>
        </div>
        <span className="muted">→</span>
      </Link>

      <div className="section-title">투자 성향</div>
      <Link href="/onboarding/persona" className="option-row" style={{ marginBottom: 26 }}>
        <div>
          <div className="option-title">투자 성향 재설정</div>
          <div className="option-desc">브리핑 깊이와 말투를 다시 맞춰요</div>
        </div>
        <span className="muted">→</span>
      </Link>

      <button className="btn btn-secondary" style={{ maxWidth: 200, marginBottom: 14 }} onClick={handleLogout}>
        로그아웃
      </button>

      {confirmingDelete ? (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>정말 탈퇴하시겠어요?</div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            계정과 관심종목, 투자 성향 등 모든 데이터가 즉시 삭제되고 되돌릴 수 없어요.
          </p>
          {deleteError && (
            <div className="error-box" style={{ marginBottom: 12 }}>
              {deleteError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              취소
            </button>
            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "탈퇴 처리 중..." : "탈퇴하기"}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" style={{ fontSize: 12, color: "#b3313f" }} onClick={() => setConfirmingDelete(true)}>
          계정 탈퇴
        </button>
      )}
    </AppShell>
  );
}
