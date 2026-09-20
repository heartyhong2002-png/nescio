"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/onboarding/update-password`,
      });
      // For security, show the same message regardless of whether the email exists.
      setMessage("메일함을 확인해주세요. 재설정 링크를 보냈어요.");
      if (error) {
        console.error("비밀번호 재설정 에러:", error);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("비밀번호 재설정 요청 중 오류가 발생했어요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page flow flow-center">
      <div className="card" style={{ maxWidth: 400, width: "100%" }}>
        <div className="back-row">
          <Link href="/onboarding/login" className="muted">
            &larr; 돌아가기
          </Link>
        </div>

        <h1 className="title-lg" style={{ marginTop: 24, marginBottom: 8 }}>
          비밀번호 재설정
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          가입할 때 쓴 이메일을 입력하면 재설정 링크를 보내드려요.
        </p>

        <form onSubmit={handleSubmit} className="flow" style={{ gap: 16 }}>
          <input
            className="field"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && <div className="error-box">{error}</div>}
          {message && (
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0, 200, 100, 0.1)", color: "var(--fg)" }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? "전송 중..." : "재설정 링크 보내기"}
          </button>
        </form>
      </div>
    </div>
  );
}
