"use client";
/* eslint-disable @next/next/no-img-element -- favicon URLs are user-provided domains and cannot use next/image remote config. */

import { useState } from "react";

const KNOWN_LOGOS: Record<string, string> = {
  "엘리스그룹": "https://elice.io/favicon.ico",
  "엘리스": "https://elice.io/favicon.ico",
};

function logoCandidates(homepage?: string | null) {
  if (!homepage) return null;
  try {
    const url = new URL(homepage.startsWith("http") ? homepage : `https://${homepage}`);
    const domain = url.hostname;
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `${url.origin}/favicon.ico`,
    ];
  } catch {
    return null;
  }
}

export default function CompanyLogo({ name, homepage, size = 42 }: { name: string; homepage?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = KNOWN_LOGOS[name] ? [KNOWN_LOGOS[name], ...logoCandidates(homepage) ?? []] : logoCandidates(homepage) ?? [];
  const src = candidates[candidateIndex];
  return <span className="company-logo" style={{ width: size, height: size }} aria-label={`${name} 로고`}>
    {src && !failed ? <img src={src} alt="" width={size - 14} height={size - 14} onError={() => candidateIndex < candidates.length - 1 ? setCandidateIndex((index) => index + 1) : setFailed(true)} /> : <strong>{name.slice(0, 1)}</strong>}
  </span>;
}
