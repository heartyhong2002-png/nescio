import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language";
import LanguageToggle from "@/components/LanguageToggle";

export const metadata: Metadata = {
  title: "nescio · 관심 종목 뉴스 맥락 브리핑",
  description: "관심 종목에 뉴스가 뜨면, 왜 중요한지 맥락까지 짚어서 알려드려요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>
          {children}
          <LanguageToggle />
        </LanguageProvider>
      </body>
    </html>
  );
}
