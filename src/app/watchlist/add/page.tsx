"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { recommendStocksForSectors, SECTORS, SECTOR_STOCKS } from "@/lib/sectors";
import { useAuth, useOnboardingProfile, useRecentSearches, useWatchlist } from "@/lib/storage";
import { Stock } from "@/lib/types";

function WatchlistAddContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";

  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useOnboardingProfile();
  const { watchlist, toggle, addMany, has, loading: watchlistLoading } = useWatchlist();
  const { recentSearches, push, remove } = useRecentSearches();

  const [tab, setTab] = useState<"recommend" | "sector">("recommend");
  const [query, setQuery] = useState("");
  const [newListings, setNewListings] = useState<Stock[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.sessionStorage.getItem("nescio.stocks-cache-v3");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [stocksError, setStocksError] = useState("");

  useEffect(() => {
    fetch("/api/stocks")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAllStocks(data.stocks);
        if (Array.isArray(data.newListings)) {
          setNewListings(data.newListings);
        }
        try {
          window.sessionStorage.setItem("nescio.stocks-cache-v3", JSON.stringify(data.stocks));
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        if (allStocks.length === 0) {
          setStocksError(err instanceof Error ? err.message : "종목 목록을 불러오지 못했습니다.");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommended = useMemo(() => recommendStocksForSectors(profile.sectors), [profile.sectors]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return allStocks.filter((stock) => stock.name.includes(trimmed) || stock.ticker.includes(trimmed)).slice(0, 24);
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
    <AppShell narrow bare={fromOnboarding}>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-title">관심종목 담기</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {fromOnboarding ? "고른 섹터에서 먼저 추천했어요." : "종목이나 섹터를 검색해 담아보세요."}
          </p>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
          {watchlist.length}개 담김
        </div>
      </div>

      {!authLoading && !user && !fromOnboarding && (
        <div
          style={{
            background: "var(--accent-soft)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>💡 계정 연동 안내</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              지금 담은 관심종목은 로그인 시 Supabase 클라우드에 안전하게 영구 저장됩니다.
            </div>
          </div>
          <Link href="/onboarding/login" className="btn btn-primary" style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: 12.5, minHeight: "unset", height: "auto" }}>
            로그인
          </Link>
        </div>
      )}

      <div className="search-field" style={{ marginBottom: 16 }}>
        🔍
        <input placeholder="종목명 · 티커 검색 (예: 네오사피엔스, 삼성전자...)" value={query} onChange={(event) => setQuery(event.target.value)} />
        {searching && (
          <button className="btn-ghost" onClick={() => setQuery("")}>
            취소
          </button>
        )}
      </div>

      {/* 오늘 & 최근 신규 상장 공모주 빠른 담기 바 */}
      {newListings.length > 0 && !searching && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="eyebrow" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
              <span>🚀</span> 오늘 & 최근 신규상장 공모주
            </div>
            <Link
              href="/ipo"
              style={{
                fontSize: 11.5,
                color: "var(--accent-dark)",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              공모주 캘린더 보기 →
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              scrollbarWidth: "none",
            }}
          >
            {newListings.slice(0, 8).map((stock) => {
              const added = has(stock.ticker);
              return (
                <button
                  key={stock.ticker}
                  type="button"
                  onClick={() => toggle(stock)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: added ? "var(--accent-soft)" : "var(--surface)",
                    border: added ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    color: added ? "var(--accent-dark)" : "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{stock.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>{stock.ticker}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: added ? "var(--accent)" : "var(--surface-sunken)",
                      color: added ? "#fff" : "var(--muted)",
                    }}
                  >
                    {added ? "✓ 담김" : "+ 담기"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {searching ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            검색 결과
          </div>
          {searchResults.length === 0 ? (
            <div className="placeholder-box" style={{ padding: 20 }}>
              찾는 종목이 없어요. 티커로도 검색해 보세요.
            </div>
          ) : (
            <div className="list-panel">
              {searchResults.map((stock) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  added={has(stock.ticker)}
                  disabled={watchlistLoading}
                  onToggle={() => {
                    toggle(stock);
                    push(query.trim());
                  }}
                />
              ))}
            </div>
          )}

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
          <div className="tabs" style={{ marginBottom: 20 }}>
            <button className={`tab ${tab === "recommend" ? "active" : ""}`} onClick={() => setTab("recommend")}>
              추천
            </button>
            <button className={`tab ${tab === "sector" ? "active" : ""}`} onClick={() => setTab("sector")}>
              섹터 · 테마
            </button>
          </div>

          {tab === "recommend" ? (
            <>
              {profileLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="skeleton" style={{ height: 56, borderRadius: 12 }} />
                  <div className="skeleton" style={{ height: 56, borderRadius: 12 }} />
                  <div className="skeleton" style={{ height: 56, borderRadius: 12 }} />
                </div>
              ) : (
                <div className="list-panel">
                  {recommended.map((stock) => (
                    <StockRow
                      key={stock.ticker}
                      stock={stock}
                      added={has(stock.ticker)}
                      disabled={watchlistLoading}
                      onToggle={() => toggle(stock)}
                    />
                  ))}
                </div>
              )}
              {stocksError && <div className="error-box" style={{ marginTop: 12 }}>{stocksError}</div>}
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                섹터를 담으면 그 안 주요 종목 뉴스를 한 번에 받아요.
              </p>
              <div className="grid-cards cols-2" style={{ marginBottom: 14 }}>
                {SECTORS.map((sector) => {
                  const allAdded = sectorAllAdded(sector.id);
                  return (
                    <button
                      key={sector.id}
                      className={`option-row ${allAdded ? "selected" : ""}`}
                      disabled={watchlistLoading}
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
            </>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 32, alignItems: "center" }}>
        <button
          className="btn btn-primary"
          style={{ minWidth: 180 }}
          disabled={watchlistLoading || watchlist.length === 0}
          onClick={finish}
        >
          {fromOnboarding ? `${watchlist.length}개 담고 시작하기` : "완료"}
        </button>
        {!fromOnboarding && <Link href="/" className="btn-ghost">← 홈으로</Link>}
      </div>
    </AppShell>
  );
}

function StockRow({
  stock,
  added,
  disabled,
  onToggle,
}: {
  stock: Stock;
  added: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="list-row">
      <div className="stock-icon">{stock.name.slice(0, 1)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{stock.name}</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
          {stock.ticker} · {stock.market}
        </div>
      </div>
      <button className={`pill ${added ? "filled" : ""}`} disabled={disabled} onClick={onToggle}>
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
