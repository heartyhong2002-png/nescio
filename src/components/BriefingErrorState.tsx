"use client";

export default function BriefingErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="briefing-error-state" role="alert">
      <div>
        <strong>죄송합니다. AI 브리핑을 불러오지 못했어요.</strong>
        <p>잠시 후 다시 실행해주세요.</p>
      </div>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div>
  );
}
