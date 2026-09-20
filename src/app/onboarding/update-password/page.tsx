"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        setError(error.message || "비밀번호 변경에 실패했습니다.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("비밀번호 변경 중 알 수 없는 오류가 발생했어요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page flow flow-center">
      <div className="card" style={{ maxWidth: 400, width: "100%" }}>
        <h1 className="title-lg" style={{ marginBottom: 8 }}>
          새 비밀번호 설정
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          새로운 비밀번호를 입력해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="flow" style={{ gap: 16 }}>
          <input
            className="field"
            type="password"
            placeholder="새 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <div className="error-box">{error}</div>}
          {success && (
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(0, 200, 100, 0.1)", color: "var(--fg)" }}>
              비밀번호가 변경되었습니다. 홈으로 이동합니다...
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || success}
          >
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}
