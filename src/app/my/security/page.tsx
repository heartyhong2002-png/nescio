"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";
import type { Factor } from "@supabase/supabase-js";

export default function SecurityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [pendingFactorId, setPendingFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Unenroll state
  const [unenrolling, setUnenrolling] = useState(false);
  const [unenrollCode, setUnenrollCode] = useState("");

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f) => f.status === "verified");
      setFactor(verified ?? null);
      setLoading(false);
    });
  }, [supabase]);

  async function startEnroll() {
    setError("");
    setEnrolling(true);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "nescio",
      friendlyName: "nescio 2FA",
    });
    if (enrollError || !data) {
      setError(enrollError?.message ?? "등록을 시작할 수 없어요.");
      setEnrolling(false);
      return;
    }
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPendingFactorId(data.id);
  }

  async function cancelEnroll() {
    // Clean up unverified factor to prevent orphans
    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    setEnrolling(false);
    setQrSvg("");
    setSecret("");
    setPendingFactorId("");
    setCode("");
    setError("");
  }

  async function verifyEnroll() {
    if (code.length !== 6) {
      setError("6자리 코드를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: pendingFactorId,
    });
    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "인증 요청에 실패했어요.");
      setSubmitting(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challengeData.id,
      code,
    });
    if (verifyError) {
      setError("코드가 올바르지 않아요. 다시 확인해 주세요.");
      setSubmitting(false);
      return;
    }
    // Success!
    const { data: factors } = await supabase.auth.mfa.listFactors();
    setFactor(factors?.totp?.find((f) => f.status === "verified") ?? null);
    setEnrolling(false);
    setQrSvg("");
    setSecret("");
    setPendingFactorId("");
    setCode("");
    setSubmitting(false);
  }

  async function startUnenroll() {
    setUnenrolling(true);
    setUnenrollCode("");
    setError("");
  }

  async function confirmUnenroll() {
    if (!factor) return;
    if (unenrollCode.length !== 6) {
      setError("6자리 코드를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);
    // Verify current code first
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "인증 요청에 실패했어요.");
      setSubmitting(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challengeData.id,
      code: unenrollCode,
    });
    if (verifyError) {
      setError("코드가 올바르지 않아요. 다시 확인해 주세요.");
      setSubmitting(false);
      return;
    }
    // Now unenroll
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) {
      setError("해제에 실패했어요: " + unenrollError.message);
      setSubmitting(false);
      return;
    }
    setFactor(null);
    setUnenrolling(false);
    setUnenrollCode("");
    setSubmitting(false);
  }

  return (
    <AppShell narrow>
      <div className="topbar">
        <div className="page-title">보안 설정</div>
      </div>

      <div className="back-row" style={{ marginBottom: 16 }}>
        <Link href="/my">← 마이</Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>2단계 인증 (TOTP)</div>

        {loading ? (
          <div className="skeleton" style={{ height: 22, width: 120, borderRadius: 6 }} />
        ) : factor ? (
          // --- 2FA 활성 상태 ---
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 6, background: "#e8f5e9", color: "#2e7d32", fontWeight: 600 }}>
                ✅ 활성화됨
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              인증 앱으로 로그인할 때마다 6자리 코드를 입력합니다.
            </p>

            {unenrolling ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>해제하려면 현재 인증 코드를 입력하세요</p>
                <input
                  className="field"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6자리 코드"
                  value={unenrollCode}
                  onChange={(e) => setUnenrollCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                {error && <div className="error-box" style={{ marginBottom: 8 }}>{error}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => { setUnenrolling(false); setError(""); }} disabled={submitting}>
                    취소
                  </button>
                  <button className="btn btn-danger" onClick={confirmUnenroll} disabled={submitting}>
                    {submitting ? "처리 중..." : "해제하기"}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={startUnenroll}>
                2단계 인증 끄기
              </button>
            )}
          </div>
        ) : enrolling ? (
          // --- 등록 진행 중 ---
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>1. 인증 앱으로 QR 코드를 스캔하세요</p>
            {qrSvg && (
              <div
                style={{ background: "white", padding: 16, borderRadius: 12, display: "inline-block", marginBottom: 12 }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>QR 코드를 스캔할 수 없나요?</summary>
              <p className="muted" style={{ fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>수동 입력 키: <code>{secret}</code></p>
            </details>

            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>2. 인증 앱에 표시된 6자리 코드를 입력하세요</p>
            <input
              className="field"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6자리 코드"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={{ marginBottom: 8 }}
            />
            {error && <div className="error-box" style={{ marginBottom: 8 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={cancelEnroll} disabled={submitting}>
                취소
              </button>
              <button className="btn btn-primary" onClick={verifyEnroll} disabled={submitting}>
                {submitting ? "확인 중..." : "등록 완료"}
              </button>
            </div>
          </div>
        ) : (
          // --- 2FA 비활성 상태 ---
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              인증 앱(Google Authenticator, Authy 등)을 사용해서 계정을 더 안전하게 보호하세요.
            </p>
            {error && <div className="error-box" style={{ marginBottom: 8 }}>{error}</div>}
            <button className="btn btn-primary" onClick={startEnroll}>
              2단계 인증 켜기
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
