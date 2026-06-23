import type { NextConfig } from "next";

// Content Security Policy
// AdSense / Steam画像 / 自己オリジン / SSE(connect) を許可。
// Next.js のインラインブートストラップのため script に 'unsafe-inline' を許容
// (将来 nonce 化で厳格化可能)。
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https://*.steamstatic.com https://steamcommunity-a.akamaihd.net https://*.googlesyndication.com https://*.g.doubleclick.net",
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.google.com https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googlesyndication.com https://*.google.com https://plausible.io",
  "frame-src https://googleads.g.doubleclick.net https://*.googlesyndication.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS (HTTPS配信時のみ有効。リバースプロキシでHTTPS終端する前提)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false, // X-Powered-By を隠す
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "community.cloudflare.steamstatic.com" },
      { protocol: "https", hostname: "community.akamai.steamstatic.com" },
      { protocol: "https", hostname: "steamcommunity-a.akamaihd.net" },
      { protocol: "https", hostname: "*.steamstatic.com" },
    ],
  },
  async headers() {
    return [
      // SSE はCSPの影響を受けないよう最小限 (キャッシュ無効のみ)
      { source: "/api/live", headers: [{ key: "Cache-Control", value: "no-cache, no-transform" }] },
      // 全ページ・APIに共通セキュリティヘッダ
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
