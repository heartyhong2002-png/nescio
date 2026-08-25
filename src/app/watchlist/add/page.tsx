"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { recommendStocksForSectors, SECTORS, SECTOR_STOCKS } from "@/lib/sectors";
import { useOnboardingProfile, useRecentSearches, useWatchlist } from "@/lib/storage";
import { Stock } from "@/lib/types";

function WatchlistAddContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";

  const { profile } = useOnboardingProfile();
  const { watchlist, toggle, addMany, has } = useWatchlist();
  const { recentSearches, push, remove } = useRecentSearches();

  const [tab, setTab] = useState<"recommend" | "sector">("recommend");
  const [query, setQuery] = useState("");
  // Lazy-read once: only feeds the search-results list, which never renders on
  // first paint (query starts empty on both server and client), so there's no
  // hydration-mismatch risk in reading sessionStorage synchronously here.
  const [allStocks, setAllStocks] = useState<Stock[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.sessionStorage.getItem("nescio.stocks-cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [stocksError, setStocksError] = useState("");

  useEffect(() => {
    if (allStocks.length > 0) return;
    fetch("/api/stocks")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAllStocks(data.stocks);
        window.sessionStorage.setItem("nescio.stocks-cache", JSON.stringify(data.stocks));
      })
      .catch((err) => setStocksError(err instanceof Error ? err.message : "종목 목록을 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommended = useMemo(() => recommendStocksForSectors(profile.sectors), [profile.sectors]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return allStocks.filter((stock) => stock.name.includes(trimmed) || stock.ticker.includes(trimmed)).slice(0, 20);
  }, [allStocks, query]);

  function finish() {
    router.push(fromOnboarding ? "/" : "/my");
  }

  function sectorAllAdded(sectorId: keyof typeof SECTOR_STOCKS) {
    return SECTOR_STOCKS[sectorId].every((stock) => has(stock.ticker));
  }

  function toggleSectorBundle(sectorId: keyof typeof SECTOR_STOCKS) {
    const stocks = SECTOR_STOCKS[sectorId];
    if (sectorAllAdded(sectorId)) {
      stocks.forEach((stock) => toggle(stock));
    } else {
      addMany(stocks);
    }
  }

  const searching = query.trim().length > 0;

  return (
    <main className="page">
      <div className="container" style={{ paddingTop: 20, paddingBottom: 28 }}>
        {!searching && (
          <>
            <div className="title-lg" style={{ marginBottom: 4 }}>
              관심종목 담기
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
              고른 섹터에서 먼저 추천했어요.
            </p>
          </>
        )}

        <div className="search-field" style={{ marginBottom: searching ? 20 : 18 }}>
          🔍
          <input
            placeholder="종목명 · 티커 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching && (
            <button className="btn-ghost" onClick={() => setQuery("")}>
              취소
            </button>
          )}
        </div>

        {searching ? (
          <>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              검색 결과
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }}>
              {searchResults.map((stock) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  added={has(stock.ticker)}
                  onToggle={() => {
                    toggle(stock);
                    push(query.trim());
                  }}
                />
              ))}
              {searchResults.length === 0 && (
                <div className="placeholder-box" style={{ padding: 14, marginTop: 12 }}>
                  찾는 종목이 없어요. 티커로도 검색해 보세요.
                </div>
              )}
            </div>

            {recentSearches.length > 0 && (
              <>
                <div className="eyebrow" style={{ margin: "26px 0 10px" }}>
                  최근 검색
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recentSearches.map((term) => (
                    <button key={term} className="chip" onClick={() => remove(term)}>
                      {term} ×
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="tabs" style={{ marginBottom: 18 }}>
              <button className={`tab ${tab === "recommend" ? "active" : ""}`} onClick={() => setTab("recommend")}>
                추천
              </button>
              <button className={`tab ${tab === "sector" ? "active" : ""}`} onClick={() => setTab("sector")}>
                섹터 · 테마
              </button>
            </div>

            {tab === "recommend" ? (
              <div style={{ borderTop: "1px solid var(--line)" }}>
                {recommended.map((stock) => (
                  <StockRow key={stock.ticker} stock={stock} added={has(stock.ticker)} onToggle={() => toggle(stock)} />
                ))}
                {stocksError && <div className="error-box" style={{ marginTop: 12 }}>{stocksError}</div>}
              </div>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  섹터를 담으면 그 안 주요 종목 뉴스를 한 번에 받아요.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {SECTORS.map((sector) => {
                    const allAdded = sectorAllAdded(sector.id);
                    return (
                      <button
                        key={sector.id}
                        className={`option-row ${allAdded ? "selected" : ""}`}
                        onClick={() => toggleSectorBundle(sector.id)}
                      >
                        <div>
                          <div className="option-title">{sector.label}</div>
                          <div className="option-desc">
                            주요 {SECTOR_STOCKS[sector.id].length}종목 · {sector.description}
                          </div>
                        </div>
                        <span className={`pill ${allAdded ? "filled" : ""}`}>{allAdded ? "담김" : "+ 담기"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="placeholder-box" style={{ padding: 13, textAlign: "left", marginBottom: 14 }}>
                  섹터를 담으면 개별 종목 편집 화면으로 이어짐 (마이 &gt; 관심종목 관리)
                </div>
              </>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {!searching && (
          <button className="btn btn-primary btn-block" disabled={watchlist.length === 0} onClick={finish}>
            {fromOnboarding ? `${watchlist.length}개 담고 시작하기` : "완료"}
          </button>
        )}

        {!fromOnboarding && (
          <div className="back-row" style={{ justifyContent: "center", paddingTop: 12 }}>
            <Link href="/">← 홈으로</Link>
          </div>
        )}
      </div>
    </main>
  );
}

function StockRow({ stock, added, onToggle }: { stock: Stock; added: boolean; onToggle: () => void }) {
  return (
    <div className="list-row">
      <div className="stock-icon">{stock.name.slice(0, 1)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{stock.name}</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
          {stock.ticker} · {stock.market}
        </div>
      </div>
      <button className={`pill ${added ? "filled" : ""}`} onClick={onToggle}>
        {added ? "담김" : "+ 담기"}
      </button>
    </div>
  );
}

export default function WatchlistAddPage() {
  return (
    <Suspense fallback={null}>
      <WatchlistAddContent />
    </Suspense>
  );
}
