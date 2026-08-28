import { Cause } from "@/lib/types";

const IMPACT_LABEL: Record<Cause["impact"], string> = {
  high: "많이 영향줬어요",
  medium: "조금 영향줬어요",
  low: "약간 영향줬어요",
};

const IMPACT_COLOR: Record<Cause["impact"], string> = {
  high: "var(--up)",
  medium: "var(--accent)",
  low: "var(--muted)",
};

function CauseCardBody({ cause }: { cause: Cause }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: IMPACT_COLOR[cause.impact], flexShrink: 0 }} />
        <span className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>
          {IMPACT_LABEL[cause.impact]}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>{cause.title}</div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>
        {cause.summary}
      </div>
    </>
  );
}

const cardStyle = (active?: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  height: "100%",
  textAlign: "left",
  color: "inherit",
  borderColor: active ? "var(--accent)" : undefined,
  borderWidth: active ? 1.5 : 1,
  background: active ? "var(--accent-soft)" : undefined,
  cursor: "pointer",
});

export function CauseCardButton({ cause, onClick, active }: { cause: Cause; onClick: () => void; active?: boolean }) {
  return (
    <button className="card-outline" style={cardStyle(active)} onClick={onClick}>
      <CauseCardBody cause={cause} />
    </button>
  );
}
