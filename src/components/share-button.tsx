"use client";
import { useEffect, useRef, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/**
 * ページ共有ボタン。
 * - 対応端末 (主にモバイル): OSのネイティブ共有シート (navigator.share)
 * - 非対応 (主にPC): コピー / X / LINE / Facebook のメニュー
 * 共有されるのは現在ページのURL (= このツールのアイテムページ) なので集客に直結。
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shareText = text ?? title;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const currentUrl = () => (typeof window !== "undefined" ? window.location.href : "");

  const onShare = async () => {
    const url = currentUrl();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: shareText, url });
      } catch {
        /* ユーザーがキャンセル: 何もしない */
      }
      return;
    }
    setOpen((o) => !o);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 不可環境では無視 */
    }
  };

  const enc = encodeURIComponent;
  const url = currentUrl();
  const links = [
    { label: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}` },
    { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={onShare} aria-haspopup="menu" aria-expanded={open}>
        <Share2 className="h-4 w-4" /> {t("share.title")}
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border bg-card text-sm shadow-lg">
          <button onClick={onCopy} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent">
            {copied ? <Check className="h-4 w-4 text-up" /> : <Copy className="h-4 w-4" />}
            {copied ? t("share.copied") : t("share.copy")}
          </button>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
