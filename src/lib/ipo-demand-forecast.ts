import { inflateRawSync } from "node:zlib";
import type { IpoDemandForecast } from "./types";

function emptyDemandForecast(): IpoDemandForecast {
  return {
    institutionParticipationCount: null,
    upperBandOrAboveOrderRatio: null,
    upperBandOrAboveInstitutionCount: null,
    lockupCompetitionRate: null,
    lockupInstitutionCount: null,
    lockupInstitutionRatio: null,
  };
}

function asNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function firstMatch(text: string, expressions: RegExp[]): string | null {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** DART 원문 표를 공백 정규화한 텍스트에서 공개된 수요예측 세부 항목만 추출한다. */
export function parseDemandForecastText(raw: string): IpoDemandForecast | null {
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text.includes("수요예측") && !text.includes("의무보유확약")) return null;

  const result = emptyDemandForecast();
  result.institutionParticipationCount = asNumber(
    firstMatch(text, [
      /총\s*([\d,]+)\s*(?:개\s*)?(?:기관|기관투자자)\s*(?:이|가)?\s*참여/i,
      /(?:기관|기관투자자)\s*참여\s*(?:기관\s*)?(?:수|건수)?\s*[:：]?\s*([\d,]+)\s*(?:개|곳|건)?/i,
    ]),
  );
  result.upperBandOrAboveInstitutionCount = asNumber(
    firstMatch(text, [
      /(?:희망\s*)?공모가(?:액)?\s*상단\s*(?:이상|초과)[^。]{0,180}?([\d,]+)\s*(?:개|곳|건)\s*기관/i,
      /상단\s*(?:이상|초과)\s*(?:가격\s*)?(?:제시|신청)[^。]{0,180}?([\d,]+)\s*(?:개|곳|건)\s*기관/i,
    ]),
  );
  const upperBandRatio = firstMatch(text, [
    /(?:희망\s*)?공모가(?:액)?\s*상단\s*(?:이상|초과)[^。]{0,220}?([\d.]+)\s*%/i,
    /상단\s*(?:이상|초과)\s*(?:가격\s*)?(?:제시|신청)[^。]{0,220}?([\d.]+)\s*%/i,
  ]);
  result.upperBandOrAboveOrderRatio = upperBandRatio ? `${upperBandRatio}%` : null;

  result.lockupInstitutionCount = asNumber(
    firstMatch(text, [
      /의무보유확약[^。]{0,220}?([\d,]+)\s*(?:개|곳|건)\s*기관/i,
      /([\d,]+)\s*(?:개|곳|건)\s*기관[^。]{0,160}?의무보유확약/i,
    ]),
  );
  const lockupRatios = [...text.matchAll(/의무보유확약[^。]{0,220}?([\d.]+)\s*%/gi)].map((match) => match[1]);
  // 공시가 기관 수 기준과 신청수량 기준을 모두 제공하면 앞의 두 값을 보존한다.
  result.lockupCompetitionRate = lockupRatios[0] ? `${lockupRatios[0]}%` : null;
  const lockupInstitutionRatio = firstMatch(text, [
    /의무보유확약[^。]{0,220}?(?:기관\s*(?:수|기준)|건수\s*기준)[^。]{0,80}?([\d.]+)\s*%/i,
    /(?:기관\s*(?:수|기준)|건수\s*기준)[^。]{0,80}?([\d.]+)\s*%[^。]{0,220}?의무보유확약/i,
  ]);
  result.lockupInstitutionRatio = lockupInstitutionRatio ? `${lockupInstitutionRatio}%` : lockupRatios[1] ? `${lockupRatios[1]}%` : null;

  // 문서 전체에는 다른 표의 확약 관련 문구도 존재한다. 참여 기관 수 또는 상단 이상
  // 주문 정보가 함께 확인되지 않은 단독 확약 수치는 수요예측 결과로 오인할 수 있어 버린다.
  const hasDemandContext =
    result.institutionParticipationCount !== null ||
    result.upperBandOrAboveInstitutionCount !== null ||
    result.upperBandOrAboveOrderRatio !== null;
  return hasDemandContext ? result : null;
}

function unzipXmlDocuments(zip: Buffer): string[] {
  const end = zip.lastIndexOf(Buffer.from("PK\x05\x06", "binary"));
  if (end < 0) return [];
  const directoryOffset = zip.readUInt32LE(end + 16);
  const entries = zip.readUInt16LE(end + 10);
  const documents: string[] = [];
  let offset = directoryOffset;

  for (let index = 0; index < entries && offset + 46 <= zip.length; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) break;
    const compression = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;
    if (!/\.xml$/i.test(name) || localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== 0x04034b50) continue;

    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = zip.subarray(start, start + compressedSize);
    const decoded = compression === 0 ? data : compression === 8 ? inflateRawSync(data) : null;
    if (decoded) documents.push(new TextDecoder("utf-8", { fatal: false }).decode(decoded));
  }
  return documents;
}

/**
 * DART document.xml은 ZIP으로 반환된다. 외부 의존성 없이 XML 파일만 읽고,
 * 원문에 실제로 적힌 수요예측 수치만 추출한다.
 */
export async function fetchDemandForecastFromDartDocument(url: string): Promise<IpoDemandForecast | null> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;
  const documents = unzipXmlDocuments(Buffer.from(await response.arrayBuffer()));
  return parseDemandForecastText(documents.join("\n"));
}
