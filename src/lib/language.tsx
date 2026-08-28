"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ko" | "en";

const STORAGE_KEY = "nescio.lang";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "ko";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * 화면 텍스트 + AI 브리핑 생성 언어를 함께 제어한다. localStorage에 저장해서
 * 다음 방문에도 유지되고, <html lang>도 같이 동기화한다.
 * (지금은 웹 버전만 지원 — 모바일 전용 UI는 나중에.)
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage를 못 쓰면 이번 세션 동안만 유지된다 */
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle: () => setLang(lang === "ko" ? "en" : "ko") }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
