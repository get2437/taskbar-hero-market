import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">管理画面</h1>
        <p className="text-sm text-muted-foreground">データ更新・再取得・キャッシュ管理・ジョブログ確認</p>
      </div>
      <AdminPanel />
    </div>
  );
}
