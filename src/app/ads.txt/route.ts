import { ADSENSE_CLIENT } from "@/lib/ads/config";

// AdSense は /ads.txt で「認可された販売者」を宣言する必要がある。
// publisher ID (ADSENSE_CLIENT="ca-pub-XXXX") から ca- を除いた pub-XXXX を出力。
// 未設定なら空(404相当の空テキスト)。env を変えれば追従するため静的ファイル不要。
export const dynamic = "force-static";

export function GET() {
  const pub = ADSENSE_CLIENT.replace(/^ca-/, "").trim();
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
