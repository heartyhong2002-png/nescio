// 메시지 로테이션은 useStockBriefing의 loadingTick이 이미 관리하고 있어서
// (LOADING_STAGES, src/lib/use-briefing.ts) 여기선 순수하게 애니메이션 + 현재 문구만 그린다.
export function LoadingBriefing({ message, height = 300 }: { message: string; height?: number }) {
  return (
    <div className="loading-briefing" style={{ minHeight: height }} role="status" aria-live="polite">
      <div className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="loading-caption">{message}</div>
    </div>
  );
}
