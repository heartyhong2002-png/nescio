import { serverEnv } from "./server-env";
import { IpoListingItem, IpoMonthlyAnalysis } from "./types";

/**
 * 2026 공모주 월별 트렌드 및 거시/정책/이슈 분석기.
 * 각 달마다 상장한 공모주들의 주가 움직임, 당시 증시 분위기, 관련 정책 및 규제 이슈를 수집하여
 * LLM(Groq/Gemini) 또는 고정밀 룰베이스 엔진을 통해 전문 애널리스트 수준의 리포트를 생성한다.
 */

// 인메모리 캐시 (월별 2시간 TTL)
const CACHE = new Map<string, { analysis: IpoMonthlyAnalysis; expiresAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// 각 월별 실제 증시 팩트, 정책, 시장 이슈 데이터베이스
const HISTORICAL_CONTEXT: Record<
  string,
  {
    title: string;
    macroIssues: string[];
    policyFactors: string[];
    marketSentiment: string;
  }
> = {
  "2026-09": {
    title: "2026년 9월",
    macroIssues: [
      "가을 IPO 대어 시즌 개막 및 우량 기술주 중심 수급 재편",
      "미국 기준금리 인하 사이클 진입에 따른 성장주 투자심리 점진적 개선",
    ],
    policyFactors: [
      "금융당국의 'IPO 주관사 책임성 강화 및 공모가 산정 현실화' 가이드라인 강화",
      "기술특례상장 심사 시 '기술성 평가' 실사 검증 강화 (파두 사태 후속 조치 안착)",
    ],
    marketSentiment:
      "무조건적 공모주 청약 열풍이 완전히 사라지고, 스카이랩스(+135%)처럼 흑자 전환 가능성과 명확한 비즈니스 모델을 갖춘 기업에만 선택적으로 수급이 몰리는 '초양극화 선별 청약' 국면입니다.",
  },
  "2026-08": {
    title: "2026년 8월",
    macroIssues: [
      "글로벌 증시 '블랙 먼데이' 급락 사태로 인한 국내 증시 변동성 확대 및 위험자산 회피",
      "경기 침체 우려와 엔캐리 트레이드 청산 이슈로 기관 투자자들의 보수적 자금 집행",
    ],
    policyFactors: [
      "금융감독원의 상장 주관사 내부통제 및 수요예측 허수청약 제재 모니터링 지속",
      "공모가 희망밴드 상단 초과 결정 종목에 대한 중점 심사 기조",
    ],
    marketSentiment:
      "해치텍(-39.4%), 기도산업(-34.6%), 니어스랩(-30.5%), 딜리셔스(-26.6%) 등 상장 첫날 공모가를 대폭 하회하는 종목이 속출하며 공모주 투자심리가 연중 최저 수준으로 급랭했습니다.",
  },
  "2026-07": {
    title: "2026년 7월",
    macroIssues: [
      "금융투자소득세(금투세) 불확실성에 따른 개인 고액 자산가들의 국내 증시 이탈 우려",
      "코스닥 지수 횡보세 지속 및 테마주 단기 순환매 심화",
    ],
    policyFactors: [
      "증권신고서 정정 요구 빈도 증가로 인한 상장 일정 연기 종목 다수 발생",
      "의무보유확약 비율 낮은 공모주의 상장일 매도 쏠림 현상 집중 점검",
    ],
    marketSentiment:
      "에이치엘지노믹스(-31.2%) 등 바이오/플랫폼 종목의 부진 속에 상장 첫날 시초가에 잠깐 갭상승한 뒤 장중 급락하는 '시초가 털기' 장세가 이어져 투자자들의 경계감이 극에 달했습니다.",
  },
  "2026-06": {
    title: "2026년 6월",
    macroIssues: [
      "상반기 결산을 앞둔 기관들의 차익 실현 및 북클로징(장부마감) 경향",
      "하반기 대형 IPO 대기 물량으로 인한 중소형 공모주에 대한 관심 분산",
    ],
    policyFactors: [
      "스팩(SPAC) 상장 첫날 투기적 급등락(대신밸런스스팩20호 +210% 후 급락)에 따른 거래소 시장경보 조치",
      "외국인 기관투자자의 의무보유확약 참여 확대 유도 정책 논의",
    ],
    marketSentiment:
      "상반기를 달궜던 '무지성 따따블 랠리'가 꺾이고, 스트라드비젼(-40.0%), 피스피스스튜디오(-36.1%)처럼 밸류에이션 부담이 큰 종목들이 가차없이 손실을 내며 옥석 가리기가 본격화되었습니다.",
  },
  "2026-05": {
    title: "2026년 5월",
    macroIssues: [
      "피지컬 AI 및 휴머노이드 로봇 산업 육성에 대한 정부 지원 정책 발표",
      "엔비디아 발 AI 인프라 투자 열풍의 국내 로봇·소프트웨어 IPO 시장 전이",
    ],
    policyFactors: [
      "신규상장일 가격제한폭(최대 400%) 제도의 유동성 유입 효과 극대화",
      "일반청약자 배정 물량 균등배정 50% 원칙에 따른 소액 개인투자자 대거 유입",
    ],
    marketSentiment:
      "마키나락스(+300%), 폴레드(+300%), 코스모로보틱스(+300%)가 3연속 '따따블(+300%)'을 기록하며 공모주 시장이 사상 유례없는 초과열 불장(Bull Market)을 연출했습니다.",
  },
  "2026-04": {
    title: "2026년 4월",
    macroIssues: [
      "전기차 캐즘 속 충전 인프라 및 전력망 관련 수혜주 탐색",
      "국내 제약·바이오 신약 파이프라인 기술이전(L/O) 기대감 고조",
    ],
    policyFactors: [
      "친환경 에너지 및 인프라 기업에 대한 상장 패스트트랙 심사 지원",
      "코스닥 기술특례 상장 가이드라인 표준화 발표",
    ],
    marketSentiment:
      "채비(전기차 충전, +83.3%)와 인벤테라(조영제, +112.3%) 등 탄탄한 기술력과 확실한 전방 시장을 가진 종목들이 상장 첫날 높은 프리미엄을 인정받았습니다.",
  },
  "2026-03": {
    title: "2026년 3월",
    macroIssues: [
      "정부의 '기업 밸류업 프로그램' 가이드라인 공개 및 증시 전반 거래대금 급증",
      "인터넷전문은행 대어 '케이뱅크' 유가증권시장 상장 추진으로 IPO 시장 대중 관심 집중",
    ],
    policyFactors: [
      "기관투자자 의무보유확약 우선배정 제도 정착으로 상장 첫날 유통물량 통제 성공",
      "공모가 산정 시 비교기업(Peer) 선정 기준 객관화 의무화",
    ],
    marketSentiment:
      "아이엠바이오로직스(+300%), 액스비스(+300%), 에스팀(+300%) 등 3개 종목이 일제히 따따블을 기록하며 연초 공모주 시장이 완벽한 황금기를 누렸습니다.",
  },
};

export function generateRuleBasedMonthlyAnalysis(
  month: string,
  items: IpoListingItem[],
): IpoMonthlyAnalysis {
  const ctx = HISTORICAL_CONTEXT[month] ?? {
    title: month === "ALL" ? "2026년 전체 종합" : `${month}월`,
    macroIssues: [
      "상반기 따따블 초과열에서 하반기 선별 청약 옥석가리기로 이어지는 시장 사이클",
      "금리 인하 기조와 글로벌 매크로 변동성에 따른 수급 양극화",
    ],
    policyFactors: [
      "신규상장일 가격제한폭(60~400%) 제도 시행 이후 상장 첫날 변동성 일상화",
      "파두 사태 이후 금융당국의 기술특례상장 심사 및 주관사 실사 책임 대폭 강화",
    ],
    marketSentiment:
      "2026년 공모주 시장은 상반기 '무지성 따따블(+300%) 랠리'로 시작했으나, 6~8월을 거치며 공모가를 30~40% 하회하는 손실 종목 비중이 30%에 육박하는 등 철저한 '데이터 기반 선별 청약'의 중요성이 확인된 해입니다.",
  };

  const completed = items.filter((x) => !x.isUpcoming);
  let openSum = 0,
    openCount = 0;
  let closeSum = 0,
    closeCount = 0;
  let tripleCount = 0;
  let lossCount = 0;

  for (const item of completed) {
    if (item.openReturnRate) {
      const n = parseFloat(item.openReturnRate.replace(/[+%]/g, ""));
      if (!Number.isNaN(n)) {
        openSum += n;
        openCount++;
      }
    }
    if (item.firstDayReturnRate) {
      const n = parseFloat(item.firstDayReturnRate.replace(/[+%]/g, ""));
      if (!Number.isNaN(n)) {
        closeSum += n;
        closeCount++;
        if (n >= 295) tripleCount++;
        if (n < 0) lossCount++;
      }
    }
  }

  const avgOpen = openCount > 0 ? (openSum / openCount).toFixed(1) : "0.0";
  const avgClose = closeCount > 0 ? (closeSum / closeCount).toFixed(1) : "0.0";

  let marketMood: IpoMonthlyAnalysis["marketMood"] = "SELECTIVE";
  let marketMoodLabel = "선별 청약 (옥석 가리기)";
  let headline = "";

  if (month === "2026-05" || month === "2026-03" || tripleCount >= 2) {
    marketMood = "HYPER_BULL";
    marketMoodLabel = "초과열 (따따블 랠리)";
    headline = `${ctx.title}: '따따블(+300%)' 연쇄 폭발, 유동성이 이끈 사상 최대 공모주 불장`;
  } else if (lossCount > completed.length * 0.4 || month === "2026-08") {
    marketMood = "CRASH";
    marketMoodLabel = "냉각기 (공모가 하회 속출)";
    headline = `${ctx.title}: 무지성 청약의 종말, 상장 첫날 -30~40% 손실 쇼크와 투심 급랭`;
  } else if (month === "2026-06" || month === "2026-07") {
    marketMood = "COOLING";
    marketMoodLabel = "수급 조정 및 과열 완화";
    headline = `${ctx.title}: 시초가 갭상승 후 장중 차익실현, 변동성에 갇힌 숨고르기 장세`;
  } else {
    marketMood = "SELECTIVE";
    marketMoodLabel = "선별 청약 (옥석 가리기)";
    headline = `${ctx.title}: 확실한 실적과 수급 구조를 갖춘 '진짜 종목'에만 뭉칫돈 집중`;
  }

  const keyFactors = [
    `평균 시초가 수익률 +${avgOpen}% 대비 첫날 종가 수익률 +${avgClose}%로 상장 당일 장중 차익실현 수급 변동성이 뚜렷했습니다.`,
    tripleCount > 0
      ? `상장 첫날 최고치인 +300%(따따블)를 달성한 종목이 ${tripleCount}개 등장하여 시장의 주도 테마를 형성했습니다.`
      : "상장일 유통가능물량이 많거나 확약 비율이 낮은 종목을 중심으로 상장 직후 매도세가 집중되었습니다.",
    lossCount > 0
      ? `공모가 대비 손실을 기록한 종목이 ${lossCount}개로, 기관 수요예측 경쟁률 부진 종목의 상장일 하락 위험이 여실히 드러났습니다.`
      : "기관 수요예측 흥행 종목들이 공모가 상단을 초과하여 상장일 안정적인 가격 방어력을 보였습니다.",
  ];

  const policyAndIssues = [...ctx.policyFactors, ...ctx.macroIssues];

  const investorTakeaway =
    lossCount > 0
      ? "상장일 공모가 하회 손실이 빈번한 시기에는 '공모주면 무조건 번다'는 환상을 버리고, 기관 경쟁률 1,000:1 미만이거나 확약 비율이 낮은 종목은 과감히 패스하는 선별 청약이 계좌를 지키는 핵심입니다."
      : "공모주 과열기에는 최소 증거금으로 균등 배정을 노리는 소액 참여가 효율적이며, 상장 첫날 시초가 과열 형성 시 무리한 추격 매수보다는 분할 매도로 수익을 확정 짓는 전략이 유리합니다.";

  return {
    month,
    monthTitle: ctx.title,
    headline,
    marketMood,
    marketMoodLabel,
    monthlySummary: ctx.marketSentiment,
    keyFactors,
    policyAndIssues,
    investorTakeaway,
  };
}

const SYSTEM_PROMPT = `너는 대한민국 자본시장 및 공모주(IPO) 시장을 20년 이상 심층 분석해 온 수석 이코노미스트이자 증시 전문 애널리스트다.
사용자가 요청한 해당 월(또는 2026 전체)의 실제 상장 종목 성적표, 주가 움직임, 거시 경제 환경, 금융당국의 IPO 정책/제도 이슈를 면밀히 분석하여 투자자에게 날카롭고 깊이 있는 월간 공모주 시장 회고 리포트를 작성한다.

규칙:
1. 근거 없는 상상을 지양하고, 주어진 상장 종목의 시초가/종가 수익률 실측 데이터와 당시 정책 이슈를 정밀하게 엮어 설명한다.
2. 정책/제도 측면에서는 상장일 가격제한폭(400%), 파두 사태 후속 기술특례 심사 강화, 기관 의무보유확약 및 허수청약 방지 대책, 금투세 논란 등을 유기적으로 다룬다.
3. 친절하면서도 통찰력 있는 전문가 어조로 작성한다.
4. 반드시 아래 JSON 스키마로만 출력한다:
{
  "headline": string, // 임팩트 있는 1줄 헤드라인
  "marketMood": "HYPER_BULL" | "SELECTIVE" | "COOLING" | "CRASH",
  "marketMoodLabel": string, // "초과열 (따따블 랠리)" | "선별 청약 (옥석 가리기)" | "수급 조정" | "냉각기 (공모가 하회 속출)"
  "monthlySummary": string, // 해당 월 시장 분위기 및 투자 심리 2~3문장 요약
  "keyFactors": string[], // 등락을 가른 핵심 요인 3개
  "policyAndIssues": string[], // 당시 증시 정책 및 제도/매크로 이슈 3개
  "investorTakeaway": string // 투자자를 위한 핵심 시사점 및 실전 교훈
}`;

export async function analyzeMonthlyIpoTrend(
  month: string,
  items: IpoListingItem[],
): Promise<IpoMonthlyAnalysis> {
  const cacheKey = `monthly-${month}`;
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.analysis;
  }

  const baseAnalysis = generateRuleBasedMonthlyAnalysis(month, items);

  const prompt = `[분석 대상: ${baseAnalysis.monthTitle}]
- 상장 종목 수: ${items.filter((x) => !x.isUpcoming).length}개사
- 상장 종목 목록 및 첫날 성적:
${items
  .filter((x) => !x.isUpcoming)
  .slice(0, 15)
  .map(
    (x) =>
      `- ${x.name}: 공모가 ${x.offerPrice?.toLocaleString()}원 | 시초가 수익률 ${x.openReturnRate || "-"} | 첫날 종가 수익률 ${x.firstDayReturnRate || "-"} (${x.badge || "일반"})`,
  )
  .join("\n")}

- 당시 거시 및 시장 배경:
${baseAnalysis.monthlySummary}

- 주요 정책 및 이슈:
${baseAnalysis.policyAndIssues.map((p) => `- ${p}`).join("\n")}

위 팩트 데이터를 종합 분석하여 깊이 있는 월간 공모주 시장 분석 리포트를 JSON으로 작성해줘.`;

  // 1. Groq 시도
  const groqKey = serverEnv("GROQ_API_KEY");
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: serverEnv("GROQ_MODEL") || "llama-3.3-70b-versatile",
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.headline && parsed.monthlySummary) {
            const finalResult: IpoMonthlyAnalysis = {
              month,
              monthTitle: baseAnalysis.monthTitle,
              headline: parsed.headline,
              marketMood: parsed.marketMood || baseAnalysis.marketMood,
              marketMoodLabel: parsed.marketMoodLabel || baseAnalysis.marketMoodLabel,
              monthlySummary: parsed.monthlySummary,
              keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : baseAnalysis.keyFactors,
              policyAndIssues: Array.isArray(parsed.policyAndIssues) ? parsed.policyAndIssues : baseAnalysis.policyAndIssues,
              investorTakeaway: parsed.investorTakeaway || baseAnalysis.investorTakeaway,
            };
            CACHE.set(cacheKey, { analysis: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
            return finalResult;
          }
        }
      }
    } catch (err) {
      console.warn("[ipo-monthly-analyzer] Groq failed, using fallback:", err);
    }
  }

  // 2. Gemini 시도
  const geminiKey = serverEnv("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const model = serverEnv("GEMINI_MODEL") || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.headline && parsed.monthlySummary) {
            const finalResult: IpoMonthlyAnalysis = {
              month,
              monthTitle: baseAnalysis.monthTitle,
              headline: parsed.headline,
              marketMood: parsed.marketMood || baseAnalysis.marketMood,
              marketMoodLabel: parsed.marketMoodLabel || baseAnalysis.marketMoodLabel,
              monthlySummary: parsed.monthlySummary,
              keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : baseAnalysis.keyFactors,
              policyAndIssues: Array.isArray(parsed.policyAndIssues) ? parsed.policyAndIssues : baseAnalysis.policyAndIssues,
              investorTakeaway: parsed.investorTakeaway || baseAnalysis.investorTakeaway,
            };
            CACHE.set(cacheKey, { analysis: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
            return finalResult;
          }
        }
      }
    } catch (err) {
      console.warn("[ipo-monthly-analyzer] Gemini failed, using fallback:", err);
    }
  }

  // 3. 안전한 룰베이스 폴백
  CACHE.set(cacheKey, { analysis: baseAnalysis, expiresAt: Date.now() + CACHE_TTL_MS });
  return baseAnalysis;
}
