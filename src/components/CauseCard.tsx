import Link from "next/link";
import { Cause } from "@/lib/types";

const IMPACT_LABEL: Record<Cause["impact"], string> = {
  high: "많이 영향줬어요",
  medium: "조금 영향줬어요",
  low: "약간 영향줬어요",
};

function CauseCardBody({ cause }: { cause: Cause }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{cause.title}</div>
        <div className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
          {IMPACT_LABEL[cause.impact]} →
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        {cause.summary}
      </div>
    </>
  );
}

const cardStyle = (active?: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  color: "inherit",
  border: active ? "1.5px solid var(--accent)" : undefined,
  cursor: "pointer",
});

export function CauseCardLink({ cause, href, active }: { cause: Cause; href: string; active?: boolean }) {
  return (
    <Link href={href} className="card-outline" style={cardStyle(active)}>
      <CauseCardBody cause={cause} />
    </Link>
  );
}

export function CauseCardButton({ cause, onClick, active }: { cause: Cause; onClick: () => void; active?: boolean }) {
  return (
    <button className="card-outline" style={cardStyle(active)} onClick={onClick}>
      <CauseCardBody cause={cause} />
    </button>
  );
}
