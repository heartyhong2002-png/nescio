"use client";

import { useState } from "react";

function faviconUrl(homepage?: string | null) {
  if (!homepage) return null;
  try {
    const url = new URL(homepage.startsWith("http") ? homepage : `https://${homepage}`);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`;
  } catch {
    return null;
  }
}

export default function CompanyLogo({ name, homepage, size = 42 }: { name: string; homepage?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(homepage);
  return <span className="company-logo" style={{ width: size, height: size }} aria-label={`${name} 로고`}>
    {src && !failed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" width={size - 14} height={size - 14} onError={() => setFailed(true)} /> : <strong>{name.slice(0, 1)}</strong>}
  </span>;
}
