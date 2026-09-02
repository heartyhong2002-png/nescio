"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuthContext } from "./auth-context";
import { useProfileContext } from "./profile-context";
import { useWatchlistContext } from "./watchlist-context";

/**
 * Supabase 전환 이후 이 파일의 역할: 기존 8개 소비 파일이 그대로 `@/lib/storage`에서
 * import하던 훅 이름/모양을 최대한 유지하면서, 실제 구현은 Context(auth-context.tsx/
 * profile-context.tsx/watchlist-context.tsx)를 읽는 얇은 selector로 바꾼 것 — 변경 범위를
 * 줄이기 위한 어댑터 레이어다.
 *
 * 예전 버전과의 API 차이(호출부가 반드시 알아야 함):
 * - `hydrated` → `loading`으로 이름 변경 (SSR 하이드레이션 블립이 아니라 진짜 네트워크
 *   로딩이라 의미가 달라졌다 — 이 이름 변경 자체가 "로딩 가드 없는 곳 다시 점검하라"는 신호).
 * - `useAuth().login(email)` → `signIn(email, password)` / `signUp(email, password)`
 *   (둘 다 async, `{error}` 반환). `logout()` → `signOut()`, 그리고 더 이상 onboarded를
 *   같이 리셋하지 않는다(실제 계정은 로그아웃해도 온보딩 상태가 DB에 남아있어야 하니까).
 * - 단독 함수였던 `completeOnboardingProfile()`은 제거 — `useOnboardingProfile().completeOnboarding()`으로
 *   대체(이제 현재 로그인된 사용자 id가 필요해서 훅 밖의 순수 함수로는 못 만든다).
 *
 * useRecentSearches()만 예외 — 계정 데이터가 아니라 그냥 검색창 자동완성용 UX 편의 캐시라서
 * Supabase로 옮길 가치가 없다. 예전처럼 localStorage + useSyncExternalStore 그대로 유지.
 */

export function useAuth() {
  const { user, loading, signIn, signUp, signOut } = useAuthContext();
  return { user: user ? { email: user.email ?? "" } : null, loading, signIn, signUp, signOut };
}

export function useOnboarded() {
  const { onboarded, loading } = useProfileContext();
  return { onboarded, loading };
}

export function useOnboardingProfile() {
  const { profile, setPersona, setSectors, toggleSector, completeOnboarding, loading } = useProfileContext();
  return { profile, setPersona, setSectors, toggleSector, completeOnboarding, loading };
}

export function useWatchlist() {
  const { watchlist, add, addMany, remove, toggle, has, loading } = useWatchlistContext();
  return { watchlist, add, addMany, remove, toggle, has, loading };
}

// ---------------------------------------------------------------------------
// 아래는 예전 storage.ts에서 그대로 가져온 localStorage 기반 구현 — 최근 검색어 전용.
// ---------------------------------------------------------------------------

const RECENT_SEARCHES_KEY = "nescio.recentSearches";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const snapshotCache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function primeSnapshot<T>(key: string, fallback: T): T {
  if (!snapshotCache.has(key)) snapshotCache.set(key, readJSON(key, fallback));
  return snapshotCache.get(key) as T;
}

function setSnapshot<T>(key: string, value: T) {
  snapshotCache.set(key, value);
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, callback: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(callback);
  return () => set!.delete(callback);
}

function useStoredValue<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    (callback) => subscribe(key, callback),
    () => primeSnapshot(key, fallback),
    () => fallback,
  );

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = primeSnapshot(key, fallback);
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      setSnapshot(key, resolved);
      return resolved;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return { value, update };
}

const emptyRecentSearches: string[] = [];

export function useRecentSearches() {
  const { value, update } = useStoredValue<string[]>(RECENT_SEARCHES_KEY, emptyRecentSearches);
  const push = useCallback((term: string) => update((current) => [term, ...current.filter((item) => item !== term)].slice(0, 8)), [update]);
  const remove = useCallback((term: string) => update((current) => current.filter((item) => item !== term)), [update]);
  return { recentSearches: value, push, remove };
}
