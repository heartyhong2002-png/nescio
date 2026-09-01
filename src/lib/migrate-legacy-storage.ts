import type { SupabaseClient } from "@supabase/supabase-js";
import { Persona, SectorId, Stock } from "./types";

/**
 * Supabase 전환 이전(localStorage 기반) 버전을 쓰던 브라우저에 남아있는 관심종목/온보딩
 * 프로필을 로그인 직후 한 번만 DB로 옮긴다. ProfileProvider가 프로필을 처음 가져온 직후 호출.
 *
 * 완벽하게 견고한 마이그레이션은 아니다(두 탭에서 동시에 첫 로그인하면 두 번 시도될 수 있음) —
 * 하지만 upsert라서 최악의 경우도 무해한 중복 no-op이라 이 정도 실용적 수준으로 충분하다.
 */
const MIGRATED_FLAG = "nescio.migrated";
const LEGACY_KEYS = {
  onboarded: "nescio.onboarded",
  profile: "nescio.profile",
  watchlist: "nescio.watchlist",
} as const;

type ProfileRow = { persona: Persona | null; sectors: SectorId[]; onboarded: boolean };

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param alreadyOnboarded 이 계정의 DB 프로필이 이미 onboarded=true인지 — true면 기존 DB
 *   데이터를 절대 덮어쓰지 않고 마이그레이션을 건너뛴다(재실행이든, 이미 다른 기기에서 가입을
 *   마친 계정이든 동일하게 처리).
 * @returns 마이그레이션으로 갱신된 프로필 행(있으면). 아무것도 옮기지 않았으면 null —
 *   호출부는 이 경우 이미 조회해둔 원래 프로필을 그대로 쓰면 된다.
 */
export async function migrateLegacyStorage(
  supabase: SupabaseClient,
  userId: string,
  alreadyOnboarded: boolean,
): Promise<ProfileRow | null> {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(MIGRATED_FLAG) === "true") return null;

  if (alreadyOnboarded) {
    window.localStorage.setItem(MIGRATED_FLAG, "true");
    return null;
  }

  try {
    const legacyOnboarded = readJSON<boolean>(LEGACY_KEYS.onboarded, false);
    const legacyProfile = readJSON<{ persona: Persona | null; sectors: SectorId[] }>(LEGACY_KEYS.profile, {
      persona: null,
      sectors: [],
    });
    const legacyWatchlist = readJSON<Stock[]>(LEGACY_KEYS.watchlist, []);

    const hasLegacyData =
      legacyOnboarded || Boolean(legacyProfile.persona) || legacyProfile.sectors.length > 0 || legacyWatchlist.length > 0;
    if (!hasLegacyData) {
      window.localStorage.setItem(MIGRATED_FLAG, "true");
      return null;
    }

    if (legacyWatchlist.length > 0) {
      const { error } = await supabase.from("watchlist_items").upsert(
        legacyWatchlist.map((stock) => ({ user_id: userId, ticker: stock.ticker, name: stock.name, market: stock.market })),
        { onConflict: "user_id,ticker" },
      );
      if (error) console.warn("[migrate] 관심종목 이전 실패:", error);
    }

    const patch: ProfileRow = { persona: legacyProfile.persona, sectors: legacyProfile.sectors, onboarded: legacyOnboarded };
    const { error: profileError } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (profileError) console.warn("[migrate] 프로필 이전 실패:", profileError);

    window.localStorage.setItem(MIGRATED_FLAG, "true");
    return profileError ? null : patch;
  } catch (error) {
    console.warn("[migrate] 레거시 데이터 이전 중 오류:", error);
    // 실패해도 플래그는 세팅한다 — 브라우저당 최선 시도 1회 원칙(매번 재시도하며 에러 로그를
    // 반복 남기는 것보다 조용히 포기하는 게 낫다).
    window.localStorage.setItem(MIGRATED_FLAG, "true");
    return null;
  }
}
