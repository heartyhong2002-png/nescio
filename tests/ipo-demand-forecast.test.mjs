import test from "node:test";
import assert from "node:assert/strict";
import { parseDemandForecastText } from "../src/lib/ipo-demand-forecast.ts";

test("DART 수요예측 원문에서 참여기관·상단 주문·확약 지표를 분리한다", () => {
  const detail = parseDemandForecastText(`
    기관투자자 수요예측 결과: 총 2,274개 기관이 참여했습니다.
    희망공모가액 상단 이상 가격 제시 2,233개 기관, 신청수량 기준 97.79%입니다.
    의무보유확약 신청 기관은 669개 기관이며 의무보유확약 비율은 29.52%, 기관수 기준 29.42%입니다.
  `);

  assert.deepEqual(detail, {
    institutionParticipationCount: 2274,
    upperBandOrAboveOrderRatio: "97.79%",
    upperBandOrAboveInstitutionCount: 2233,
    lockupCompetitionRate: "29.52%",
    lockupInstitutionCount: 669,
    lockupInstitutionRatio: "29.42%",
  });
});

test("수요예측 원문이 아닌 텍스트는 빈 결과로 처리한다", () => {
  assert.equal(parseDemandForecastText("일반 청약 일정 안내"), null);
});

test("참여·가격제시 근거가 없는 단독 확약 수치는 수요예측 결과로 표시하지 않는다", () => {
  assert.equal(parseDemandForecastText("의무보유확약 비율은 11.71%이며 기관수 기준 0.84%입니다."), null);
});
