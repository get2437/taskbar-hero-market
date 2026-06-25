"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 「一覧へ戻る」ボタン。ブラウザ戻り(router.back)で、フィルタ済みの一覧URLに戻す。
 * 直接アクセス等で履歴が無い場合は home(/) にフォールバック。
 */
export function BackButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
      }}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
