import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 모든 경로에 기본 보안 헤더 적용 — 클릭재킹(iframe 삽입) 방지, MIME 스니핑 방지,
        // 다른 사이트로 넘어갈 때 전체 URL(쿼리 등)이 새지 않도록 리퍼러 제한.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
