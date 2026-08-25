"use client";

import { useCallback, useSyncExternalStore } from "react";
import { OnboardingProfile, SectorId, Stock } from "./types";

const KEYS = {
  onboarded: "nescio.onboarded",
  auth: "nescio.auth",
  profile: "nescio.profile",
  watchlist: "nescio.watchlist",
  recentSearches: "nescio.recentSearches",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Per-key snapshot cache so useSyncExternalStore's getSnapshot returns a stable
// reference until the value actually changes — JSON.parse would otherwise
// create a new object on every call, which React treats as "always changing".
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

function noopSubscribe() {
  return () => {};
}

/** True once mounted on the client. Matches SSR/hydration output, then flips after mount. */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
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

export function useOnboarded() {
  const { value, update } = useStoredValue<boolean>(KEYS.onboarded, false);
  return { onboarded: value, setOnboarded: (val: boolean) => update(val), hydrated: useHydrated() };
}

export function useAuth() {
  const { value, update } = useStoredValue<{ email: string } | null>(KEYS.auth, null);
  const login = useCallback((email: string) => update({ email }), [update]);
  const logout = useCallback(() => {
    update(null);
    setSnapshot(KEYS.onboarded, false);
  }, [update]);
  return { user: value, login, logout, hydrated: useHydrated() };
}

const emptyProfile: OnboardingProfile = { persona: null, sectors: [] };

export function useOnboardingProfile() {
  const { value, update } = useStoredValue<OnboardingProfile>(KEYS.profile, emptyProfile);
  const setPersona = useCallback((persona: OnboardingProfile["persona"]) => update((current) => ({ ...current, persona })), [update]);
  const setSectors = useCallback((sectors: SectorId[]) => update((current) => ({ ...current, sectors })), [update]);
  const toggleSector = useCallback(
    (sector: SectorId) =>
      update((current) => ({
        ...current,
        sectors: current.sectors.includes(sector)
          ? current.sectors.filter((id) => id !== sector)
          : [...current.sectors, sector],
      })),
    [update],
  );
  return { profile: value, setPersona, setSectors, toggleSector, hydrated: useHydrated() };
}

const emptyStockList: Stock[] = [];

export function useWatchlist() {
  const { value, update } = useStoredValue<Stock[]>(KEYS.watchlist, emptyStockList);
  const add = useCallback((stock: Stock) => update((current) => (current.some((item) => item.ticker === stock.ticker) ? current : [...current, stock])), [update]);
  const addMany = useCallback(
    (stocks: Stock[]) =>
      update((current) => {
        const existing = new Set(current.map((item) => item.ticker));
        return [...current, ...stocks.filter((stock) => !existing.has(stock.ticker))];
      }),
    [update],
  );
  const remove = useCallback((ticker: string) => update((current) => current.filter((item) => item.ticker !== ticker)), [update]);
  const toggle = useCallback(
    (stock: Stock) =>
      update((current) =>
        current.some((item) => item.ticker === stock.ticker)
          ? current.filter((item) => item.ticker !== stock.ticker)
          : [...current, stock],
      ),
    [update],
  );
  const has = useCallback((ticker: string) => value.some((item) => item.ticker === ticker), [value]);
  return { watchlist: value, add, addMany, remove, toggle, has, hydrated: useHydrated() };
}

const emptyRecentSearches: string[] = [];

export function useRecentSearches() {
  const { value, update } = useStoredValue<string[]>(KEYS.recentSearches, emptyRecentSearches);
  const push = useCallback(
    (term: string) =>
      update((current) => [term, ...current.filter((item) => item !== term)].slice(0, 8)),
    [update],
  );
  const remove = useCallback((term: string) => update((current) => current.filter((item) => item !== term)), [update]);
  return { recentSearches: value, push, remove, hydrated: useHydrated() };
}

export function completeOnboardingProfile() {
  setSnapshot(KEYS.onboarded, true);
}
