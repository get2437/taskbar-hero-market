import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-black text-muted-foreground/30">404</div>
      <p className="text-muted-foreground">アイテムまたはページが見つかりませんでした。</p>
      <Button asChild>
        <Link href="/">ダッシュボードへ戻る</Link>
      </Button>
    </div>
  );
}
