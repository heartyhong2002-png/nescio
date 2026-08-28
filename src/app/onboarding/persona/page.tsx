"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOnboardingProfile } from "@/lib/storage";
import { Persona } from "@/lib/types";

const PERSONAS: { id: Persona; title: string; desc: string }[] = [
  { id: "beginner", title: "주린이", desc: "용어부터 풀어서 설명" },
  { id: "general", title: "일반인", desc: "핵심 지표 중심" },
  { id: "expert", title: "쌉고수", desc: "원문 · 데이터 우선" },
];

export default function PersonaPage() {
  const router = useRouter();
  const { profile, setPersona } = useOnboardingProfile();

  function choose(persona: Persona) {
    setPersona(persona);
    router.push("/onboarding/sectors");
  }

  return (
    <main className="page">
      <div className="flow">
        <div className="back-row" style={{ gap: 10 }}>
          <Link href="/onboarding/login">←</Link>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: "50%" }} />
          </div>
          <span style={{ fontSize: 11 }}>1/2</span>
        </div>

        <div className="title-lg" style={{ marginBottom: 8 }}>
          투자 성향을 알려주세요
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
          브리핑 깊이와 말투를 맞추는 데 써요.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PERSONAS.map((persona) => {
            const selected = profile.persona === persona.id;
            return (
              <button key={persona.id} className={`option-row ${selected ? "selected" : ""}`} onClick={() => choose(persona.id)}>
                <div>
                  <div className="option-title">{persona.title}</div>
                  <div className="option-desc">{persona.desc}</div>
                </div>
                <div className={`radio-dot ${selected ? "checked" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
