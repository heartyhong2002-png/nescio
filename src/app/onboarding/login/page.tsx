"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<"google" | "kakao" | null>(null);

  async function handleOAuth(provider: "google" | "kakao") {
    setError("");
    setOauthPending(provider);
    // 성공하면 브라우저가 바로 provider 로그인 화면으로 떠나기 때문에 이 함수가 끝까지 실행될
    // 일은 거의 없다 — 실패(예: provider 설정이 아직 안 된 경우)했을 때만 여기로 돌아온다.
    const { error: oauthError } = await signInWithOAuth(provider);
    if (oauthError) {
      setError(oauthError);
      setOauthPending(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    if (mode === "signup") {
      const { error: signUpError, needsEmailConfirm } = await signUp(email.trim(), password);
      setSubmitting(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      if (needsEmailConfirm) {
        // 세션이 아직 없는 상태 — 이대로 온보딩에 들여보내면 로그인 안 된 채로 클릭해도 아무
        // 것도 저장 안 되는 버그가 생긴다(useAuthContext().user가 null이라 profile/watchlist
        // 업데이트가 전부 조용히 no-op됨). 메일 인증부터 하게 안내한다.
        setError("가입 확인 메일을 보냈어요. 메일함에서 인증 링크를 누른 뒤 다시 로그인해주세요.");
        setMode("login");
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

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-block btn-oauth-google"
            disabled={oauthPending !== null}
            onClick={() => handleOAuth("google")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            {oauthPending === "google" ? "이동 중..." : "Google로 계속하기"}
          </button>
          <button
            type="button"
            className="btn btn-block btn-oauth-kakao"
            disabled={oauthPending !== null}
            onClick={() => handleOAuth("kakao")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#191919"
                d="M9 1.5C4.582 1.5 1 4.253 1 7.65c0 2.184 1.487 4.1 3.72 5.194-.164.586-.594 2.122-.68 2.452-.107.41.15.404.317.294.13-.086 2.08-1.394 2.923-1.964.55.08 1.117.124 1.72.124 4.418 0 8-2.753 8-6.15S13.418 1.5 9 1.5z"
              />
            </svg>
            {oauthPending === "kakao" ? "이동 중..." : "카카오로 계속하기"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span className="muted" style={{ fontSize: 12 }}>
            또는
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

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
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting || oauthPending !== null}>
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
