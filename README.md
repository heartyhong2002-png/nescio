This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 환경변수

`.env.local`에 아래 값을 설정하면 관심종목 뉴스 수집과 AI 분석을 사용할 수 있습니다.

```env
NAVER_CLIENT_ID=네이버_클라이언트_ID
NAVER_CLIENT_SECRET=네이버_클라이언트_SECRET
XAI_API_KEY=xAI_API_KEY
# 선택: KIS 종목투자의견(증권사 리포트) 조회
KIS_APP_KEY=한국투자증권_앱키
KIS_APP_SECRET=한국투자증권_앱시크릿
# 선택: 기본값은 실전투자 API 주소
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
# 선택: 일별 주가와 등락률 조회
KRX_AUTH_KEY=한국거래소_API_KEY
# 선택
XAI_MODEL=grok-4-1-fast-non-reasoning
```

화면의 **변동 이유 분석** 버튼은 `/api/analyze`로 종목명과 티커를 보내 네이버 뉴스, KRX 시세(키가 있는 경우), xAI 분석 결과를 한 번에 반환합니다.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
