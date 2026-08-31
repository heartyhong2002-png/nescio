// exim.ts(서버 전용, fs 사용)를 클라이언트 컴포넌트에서 그대로 import하지 않도록
// 공유해야 하는 상수만 이 파일로 분리했다. exim.ts의 MAJOR_CURRENCY_CODES와 동일하게 유지할 것.
export const MAJOR_CURRENCY_CODES_CLIENT = ["USD", "JPY", "EUR", "CNH", "CNY", "GBP"];
