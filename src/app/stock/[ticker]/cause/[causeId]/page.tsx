"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import CauseDetailView from "@/components/CauseDetailView";
import { useStockBriefing } from "@/lib/use-briefing";

function CauseBriefingContent() {
  const params = useParams<{ ticker: string; causeId: string }>();
  const searchParams = useSearchParams();
  const ticker = params.ticker;
  const name = searchParams.get("name") ?? undefined;

  const { analysis, loading, error, refresh } = useStockBriefing(ticker, name);
  const cause = analysis?.briefing.causes.find((item) => item.id === params.causeId);
  const displayName = analysis?.stock.name ?? name ?? ticker;

  return (
    <AppShell narrow>
      <div className="back-row">
        <Link href={`/stock/${ticker}?name=${encodeURIComponent(displayName)}`}>← {displayName} 브리핑</Link>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="skeleton" style={{ height: 30, width: "60%" }} />
          <div className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      )}

      {error && (
        <div className="error-box">
          {error}{" "}
          <button className="btn-ghost" onClick={refresh}>
            다시 시도
          </button>
        </div>
      )}

      {analysis && !loading && !cause && (
        <div className="placeholder-box" style={{ padding: 28 }}>
          해당 원인 브리핑을 찾을 수 없어요.
        </div>
      )}

      {analysis && cause && (
        <div className="card" style={{ padding: 24 }}>
          <CauseDetailView analysis={analysis} cause={cause} />
        </div>
      )}
    </AppShell>
  );
}

export default function CauseBriefingPage() {
  return (
    <Suspense fallback={null}>
      <CauseBriefingContent />
    </Suspense>
  );
}
