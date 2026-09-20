"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VerifyMfaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  async function verify() {
    if (code.length !== 6) {
      setError("6자리 코드를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    // Get the TOTP factor
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.find((f) => f.status === "verified");
    if (!totpFactor) {
      setError("등록된 인증 수단을 찾을 수 없어요.");
      setSubmitting(false);
      return;
    }

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "인증 요청에 실패했어요.");
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challengeData.id,
      code,
    });
    if (verifyError) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        await supabase.auth.signOut();
        setError("인증에 3회 실패했어요. 다시 로그인해 주세요.");
        setTimeout(() => router.push("/onboarding/login"), 2000);
        return;
      }
      setError(`코드가 올바르지 않아요. (${3 - newAttempts}회 남음)`);
      setCode("");
      setSubmitting(false);
      return;
    }

    // AAL2 verified - go to home
    router.push("/");
  }

  return (
    <main className="page">
      <div className="flow flow-center">
        <div className="title-lg" style={{ margin: "16px 0 8px", alignSelf: "flex-start" }}>
          2단계 인증
        </div>
        <p className="muted" style={{ fontSize: 14, marginBottom: 28, alignSelf: "flex-start" }}>
          인증 앱에 표시된 6자리 코드를 입력해 주세요.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginBottom: 20 }}>
          <input
            className="field"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6자리 코드"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
          />
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-block" onClick={verify} disabled={submitting}>
            {submitting ? "확인 중..." : "확인"}
          </button>
        </div>
      </div>
    </main>
  );
}
