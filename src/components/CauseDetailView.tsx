"use client";

import { Analysis, Cause } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function CauseDetailView({ analysis, cause }: { analysis: Analysis; cause: Cause }) {
  const { t } = useI18n();
  const sourceNews = cause.newsIndices.map((index) => analysis.news[index]).filter(Boolean);

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {t.causeDetail.briefingPrefix}
        {cause.title}
      </div>
      <div className="title-md" style={{ lineHeight: 1.45, marginBottom: 12 }}>
        {t.causeDetail.question}
      </div>

      {cause.conclusion && (
        <div className="card-outline" style={{ border: "1.5px solid var(--accent)", marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {t.causeDetail.inOneLine}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{cause.conclusion}</div>
        </div>
      )}

      {cause.timeline.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 12 }}>
            {t.causeDetail.stepByStep}
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
          <div className="section-title">{t.causeDetail.newsCount(sourceNews.length)}</div>
          <div style={{ borderTop: "1px solid var(--line)", marginBottom: 20 }}>
            {sourceNews.map((item) => (
              <a key={item.link} href={item.link} target="_blank" rel="noreferrer" style={{ display: "block", padding: "11px 0", borderBottom: "1px solid var(--line)", color: "inherit" }}>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                  {new Date(item.pubDate).toLocaleDateString(t.causeDetail.locale)}
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {(cause.expertOpinions.bullish.count > 0 || cause.expertOpinions.bearish.count > 0) && (
        <>
          <div className="section-title">{t.causeDetail.expertsView}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div className="card-outline" style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>
                {t.causeDetail.bullishCount(cause.expertOpinions.bullish.count)}
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 5 }}>
                {cause.expertOpinions.bullish.summary}
              </div>
            </div>
            <div className="card-outline" style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 10 }}>
                {t.causeDetail.bearishCount(cause.expertOpinions.bearish.count)}
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
            {t.causeDetail.similarCase}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", lineHeight: 1.55 }}>{cause.similarCase}</div>
        </div>
      )}
    </>
  );
}
