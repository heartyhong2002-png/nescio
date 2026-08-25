"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeOnboardingProfile, useOnboardingProfile } from "@/lib/storage";
import { SECTORS } from "@/lib/sectors";

export default function SectorsPage() {
  const router = useRouter();
  const { profile, toggleSector } = useOnboardingProfile();
  const canContinue = profile.sectors.length > 0;

  function finish() {
    if (!canContinue) return;
    completeOnboardingProfile();
    router.push("/watchlist/add?from=onboarding");
  }

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="back-row" style={{ gap: 10 }}>
          <Link href="/onboarding/persona">←</Link>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: "100%" }} />
          </div>
          <span style={{ fontSize: 11 }}>2/2</span>
        </div>

        <div className="title-lg" style={{ marginBottom: 14 }}>
          관심 섹터를 골라주세요
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {SECTORS.map((sector) => {
            const selected = profile.sectors.includes(sector.id);
            return (
              <button key={sector.id} className={`chip ${selected ? "selected" : ""}`} onClick={() => toggleSector(sector.id)}>
                {sector.label}
              </button>
            );
          })}
        </div>

        <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>
          최소 1개 선택하면 다음으로 넘어갈 수 있어요. 고른 섹터를 기준으로 종목을 추천해 드려요.
        </p>

        <div style={{ flex: 1 }} />

        <button className="btn btn-primary btn-block" disabled={!canContinue} onClick={finish}>
          관심종목 담으러 가기
        </button>
      </div>
    </main>
  );
}
