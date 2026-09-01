"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "./supabase/client";
import { useAuthContext } from "./auth-context";
import { migrateLegacyStorage } from "./migrate-legacy-storage";
import { OnboardingProfile, Persona, SectorId } from "./types";

type ProfileRow = { persona: Persona | null; sectors: SectorId[]; onboarded: boolean };

type ProfileContextValue = {
  profile: OnboardingProfile;
  onboarded: boolean;
  loading: boolean;
  setPersona: (persona: Persona | null) => Promise<void>;
  setSectors: (sectors: SectorId[]) => Promise<void>;
  toggleSector: (sector: SectorId) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const emptyProfile: OnboardingProfile = { persona: null, sectors: [] };

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuthContext();
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // 인증 상태 자체가 아직 로딩 중이면 기다린다.

    let active = true;

    // react-hooks/set-state-in-effect 린트는 이펙트 본문에서 곧바로 setState를 호출하는 걸
    // 지적한다(setLoading(true)조차도) — 그래서 전체를 마이크로태스크 콜백 안에 넣어서, 모든
    // setState 호출이 이펙트 함수 자체가 아니라 중첩된 콜백 안에서 일어나게 한다.
    Promise.resolve().then(async () => {
      if (!active) return;

      if (!user) {
        setRow(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("persona, sectors, onboarded")
        .eq("id", user.id)
        .single();
      if (!active) return;

      if (error) {
        console.warn("[profile] 프로필 조회 실패:", error);
        setRow({ persona: null, sectors: [], onboarded: false });
        setLoading(false);
        return;
      }
      const fetched: ProfileRow = {
        persona: (data?.persona as Persona | null) ?? null,
        sectors: (data?.sectors as SectorId[] | null) ?? [],
        onboarded: data?.onboarded ?? false,
      };
      // 이 브라우저에 예전 localStorage 버전 데이터가 남아있으면(관심종목/온보딩 프로필)
      // 한 번만 DB로 옮긴다 — 이미 온보딩을 마친 계정이면 기존 DB 데이터를 덮어쓰지 않고 건너뛴다.
      const migrated = await migrateLegacyStorage(supabase, user.id, fetched.onboarded);
      if (!active) return;
      setRow(migrated ?? fetched);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [supabase, user, authLoading]);

  const updateRow = useCallback(
    async (patch: Partial<ProfileRow>) => {
      if (!user) return;
      setRow((current) => (current ? { ...current, ...patch } : current)); // 낙관적 업데이트
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) console.warn("[profile] 업데이트 실패:", error);
    },
    [supabase, user],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: { persona: row?.persona ?? null, sectors: row?.sectors ?? [] },
      onboarded: row?.onboarded ?? false,
      loading,
      setPersona: (persona) => updateRow({ persona }),
      setSectors: (sectors) => updateRow({ sectors }),
      toggleSector: (sector) => {
        const current = row?.sectors ?? [];
        const next = current.includes(sector) ? current.filter((id) => id !== sector) : [...current, sector];
        return updateRow({ sectors: next });
      },
      completeOnboarding: () => updateRow({ onboarded: true }),
    }),
    [row, loading, updateRow],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext는 ProfileProvider 안에서만 쓸 수 있어요.");
  return ctx;
}

export { emptyProfile };
