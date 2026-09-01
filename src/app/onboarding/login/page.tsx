"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    if (mode === "signup") {
      const { error: signUpError } = await signUp(email.trim(), password);
      setSubmitting(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      // 신규 가입은 항상 온보딩부터 시작.
      router.push("/onboarding/persona");
      return;
    }

    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setSubmitting(false);
      setError(signInError);
      return;
    }

    // 이미 온보딩을 마친 재방문 유저는 온보딩을 다시 태우지 않고 홈으로 보낸다. AuthProvider/
    // ProfileProvider의 상태 전파를 기다리지 않고(레이스 방지) 여기서 직접 한 번 더 조회해서
    // 라우팅을 결정한다.
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSubmitting(false);
      router.push("/onboarding/persona");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", userId).single();
    setSubmitting(false);
    router.push(profile?.onboarded ? "/" : "/onboarding/persona");
  }

  return (
    <main className="page">
      <div className="flow flow-center">
        <div className="back-row" style={{ width: "100%" }}>
          <Link href="/onboarding">← 뒤로</Link>
        </div>

        <div className="title-lg" style={{ margin: "16px 0 8px", alignSelf: "flex-start" }}>
          {mode === "login" ? "시작하기" : "회원가입"}
        </div>
        <p className="muted" style={{ fontSize: 14, marginBottom: 28, alignSelf: "flex-start" }}>
          브리핑을 저장하려면 계정이 필요해요.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <input
            className="field"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <input
            className="field"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "처리 중..." : mode === "login" ? "로그인" : "가입하고 시작하기"}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
          {mode === "login" ? (
            <>
              계정이 없으신가요?{" "}
              <button type="button" style={{ textDecoration: "underline", color: "var(--ink)" }} onClick={() => setMode("signup")}>
                회원가입
              </button>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{" "}
              <button type="button" style={{ textDecoration: "underline", color: "var(--ink)" }} onClick={() => setMode("login")}>
                로그인
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
