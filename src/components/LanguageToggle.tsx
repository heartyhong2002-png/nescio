"use client";

import { useLanguage } from "@/lib/language";

/**
 * 화면 어디서든 접근 가능한 언어 전환 버튼. AppShell/SiteHeader가
 * 다른 세션에서 한창 리팩토링 중이라 그 파일들을 건드리지 않고,
 * 레이아웃 밖에서 독립적으로 띄우는 필로 구현했다.
 * 나중에 헤더 안으로 옥겨도 된다.
 */
export default function LanguageToggle() {
  const { lang, toggle } = useLanguage();

  return (
    <button
      onClick={toggle}
      aria-label={lang === "ko" ? "Switch to English" : "한국어로 전환"}
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 200,
        padding: "9px 14px",
        borderRadius: 999,
        border: "1px solid var(--line-strong)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: "var(--ink)",
        cursor: "pointer",
      }}
    >
      {lang === "ko" ? "EN" : "한글"}
    </button>
  );
}
