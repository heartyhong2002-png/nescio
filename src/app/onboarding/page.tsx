"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SLIDES = [
  {
    title: "뉴스가 떴는데\n그게 무슨 뜻인지 모를 때",
    body: "관심 종목에 뉴스가 뜨면, 왜 중요한지 맥락까지 짚어서 알려드려요.",
    icon: "📰",
  },
  {
    title: "여러 종목이\n같은 이유로 움직일 때",
    body: "따로따로 찾아보지 않아도, 하나의 사건으로 묶어서 설명해 드려요.",
    icon: "🔗",
  },
  {
    title: "결론부터,\n그다음 근거까지",
    body: "한 줄 결론 → 인과관계 → 근거 뉴스 순서로, 필요한 만큼만 읽으세요.",
    icon: "✅",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];

  function next() {
    if (step < SLIDES.length - 1) setStep(step + 1);
    else router.push("/onboarding/login");
  }

  return (
    <main className="page">
      <div className="flow flow-center">
        <div className="back-row" style={{ justifyContent: "flex-end", width: "100%" }}>
          <button onClick={() => router.push("/onboarding/login")}>건너뛰기</button>
        </div>

        <div
          style={{
            fontSize: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 180,
            background: "var(--accent-soft)",
            borderRadius: "var(--radius-lg)",
            marginBottom: 28,
            width: "100%",
          }}
        >
          {slide.icon}
        </div>

        <div className="title-lg" style={{ marginBottom: 12, whiteSpace: "pre-line", alignSelf: "flex-start" }}>
          {slide.title}
        </div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 28, alignSelf: "flex-start" }}>
          {slide.body}
        </p>

        <div className="dots" style={{ marginBottom: 20, alignSelf: "flex-start" }}>
          {SLIDES.map((_, index) => (
            <span key={index} className={`dot ${index === step ? "active" : ""}`} />
          ))}
        </div>

        <button className="btn btn-primary btn-block" onClick={next}>
          {step < SLIDES.length - 1 ? "다음" : "시작하기"}
        </button>
      </div>
    </main>
  );
}
