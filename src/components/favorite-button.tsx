"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  itemId,
  initial = false,
  size = 18,
  className,
}: {
  itemId: string;
  initial?: boolean;
  size?: number;
  className?: string;
}) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setFav((v) => !v); // 楽観的更新
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      setFav(data.favorited);
    } catch {
      setFav((v) => !v); // 失敗時ロールバック
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={fav ? "お気に入り解除" : "お気に入り登録"}
      aria-pressed={fav}
      className={cn("inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-amber-400", fav && "text-amber-400", className)}
    >
      <Star style={{ width: size, height: size }} className={cn(fav && "fill-current")} />
    </button>
  );
}
