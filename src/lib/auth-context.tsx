"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";

/**
 * 인증 상태를 앱 전체에서 한 번만 구독해서 공유한다. 훅마다 각자 Supabase를 부르게 하면
 * 페이지 이동할 때마다 다시 로딩되는 깜빡임이 생기기 때문 — Providers.tsx가 루트에서 한 번
 * 감싸고, storage.ts의 useAuth()는 이 컨텍스트를 읽는 얇은 selector가 된다.
 */
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  // needsEmailConfirm: Supabase "Confirm email"이 켜져 있으면 signUp이 성공해도 세션이 안 생긴다
  // (링크를 눌러야 로그인됨). 이 경우를 호출부가 구분 못 하면, 세션 없는(=user null) 상태로
  // 그대로 온보딩 페이지에 들어가서 프로필/관심종목 저장이 전부 조용히 실패하는 버그가 생긴다.
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  // 구글/카카오 로그인. 성공하면 브라우저가 즉시 provider 인증 화면으로 리다이렉트되므로(현재
  // 페이지는 그대로 떠난다), 반환값의 error는 "리다이렉트 자체가 시작되지 못한" 경우에만 의미가
  // 있다 — 실제 로그인 성공/실패 판정은 콜백 라우트(src/app/auth/callback/route.ts)가 담당한다.
  signInWithOAuth: (provider: "google" | "kakao") => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase 에러 메시지를 그대로 노출하면 영어라 초보 투자자 타겟과 안 맞는다 — 자주 나오는
// 케이스만 한글로 옮기고, 나머지는 원문을 그대로 보여준다(완전히 안 보여주는 것보다 낫다).
function translateAuthError(message: string): string {
  if (message.includes("already registered")) return "이미 가입된 이메일이에요.";
  if (message.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (message.includes("Password should be at least")) return "비밀번호는 최소 6자 이상이어야 해요.";
  if (message.includes("Unable to validate email")) return "올바른 이메일 형식이 아니에요.";
  if (message.includes("Email not confirmed")) return "이메일 인증이 필요해요. 받은 메일함을 확인해주세요.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 로그인/로그아웃/토큰 갱신 등 세션이 바뀔 때마다 반영 — 다른 탭에서 로그아웃해도 여기도 따라간다.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? translateAuthError(error.message) : null };
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: translateAuthError(error.message), needsEmailConfirm: false };
        // signUp은 성공했는데 세션이 없으면 "Confirm email"이 켜져 있어서 이메일 인증 전이라는 뜻.
        return { error: null, needsEmailConfirm: !data.session };
      },
      async signInWithOAuth(provider) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        return { error: error ? translateAuthError(error.message) : null };
      },
      async signOut() {
        await supabase.auth.signOut();
        // 주의: onboarded 플래그는 여기서 건드리지 않는다 — 예전 로컬스토리지 버전은
        // 로그아웃하면 onboarded도 같이 리셋해서 재로그인 시 항상 온보딩을 다시 태웠지만,
        // 이제는 profiles.onboarded가 DB에 남아있는 실제 계정 데이터라 그러면 안 된다.
      },
    }),
    [user, loading, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext는 AuthProvider 안에서만 쓸 수 있어요.");
  return ctx;
}
