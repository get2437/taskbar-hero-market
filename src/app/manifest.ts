import type { MetadataRoute } from "next";

// PWA マニフェスト (ホーム画面に追加・スタンドアロン表示)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taskbar Hero Market Analytics",
    short_name: "TH Market",
    description: "Stock-style analytics for the Steam Community Market of Taskbar Hero.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
