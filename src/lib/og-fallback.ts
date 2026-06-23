// OG画像のレンダリングに失敗した場合の安全フォールバック。
// crawler に対して 500 を返さず、有効な(極小)PNGを返すことでサイトへの悪影響をゼロにする。
// 通常の Linux 本番では ImageResponse が成功するため、これは保険。
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export function ogFallback(): Response {
  return new Response(Buffer.from(PNG_1x1, "base64"), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=300" },
  });
}
