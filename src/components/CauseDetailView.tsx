import { Analysis, Cause } from "@/lib/types";

export default function CauseDetailView({ analysis, cause }: { analysis: Analysis; cause: Cause }) {
  const sourceNews = cause.newsIndices.map((index) => analysis.news[index]).filter(Boolean);

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        원인 브리핑 · {cause.title}
      </div>
      <div className="title-md" style={{ lineHeight: 1.45, marginBottom: 12 }}>
        왜 그렇게 움직였나요?
      </div>

      {cause.conclusion && (
        <div className="card-outline" style={{ border: "1.5px solid var(--accent)", marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            한 줄로 말하면
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{cause.conclusion}</div>
        </div>
      )}

      {cause.timeline.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 12 }}>
            순서대로 정리하면
          </div>
          <div style={{ marginBottom: 22 }}>
            {cause.timeline.map((step, index) => (
              <div key={index} className="timeline-step">
                <div className="timeline-rail">
                  <div className="timeline-num">{index + 1}</div>
                  {index < cause.timeline.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-body">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{step.title}</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sourceNews.length > 0 && (
        <>
          <div className="section-title">이 이야기가 나온 뉴스 {sourceNews.length}개</div>
          <div style={{ borderTop: "1px solid var(--line)", marginBottom: 20 }}>
            {sourceNews.map((item) => (
              <a key={item.link} href={item.link} target="_blank" rel="noreferrer" style={{ display: "block", padding: "11px 0", borderBottom: "1px solid var(--line)", color: "inherit" }}>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                  {new Date(item.pubDate).toLocaleDateString("ko-KR")}
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {(cause.expertOpinions.bullish.count > 0 || cause.expertOpinions.bearish.count > 0) && (
        <>
          <div className="section-title">전문가는 이렇게 봐요</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div className="card-outline" style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>
                오를 것 같다 {cause.expertOpinions.bullish.count}명
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 5 }}>
                {cause.expertOpinions.bullish.summary}
              </div>
            </div>
            <div className="card-outline" style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>
                조심하자는 의견 {cause.expertOpinions.bearish.count}명
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 5 }}>
                {cause.expertOpinions.bearish.summary}
              </div>
            </div>
          </div>
        </>
      )}

      {cause.similarCase && (
        <div className="hero-card">
          <div className="eyebrow" style={{ marginBottom: 5 }}>
            비슷한 일이 있었을 때
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.55 }}>{cause.similarCase}</div>
        </div>
      )}
    </>
  );
}
