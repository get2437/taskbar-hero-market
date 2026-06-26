"use client";
import { useT } from "@/lib/i18n/provider";
import { resolveItemName, type NameI18n } from "@/lib/item-name";

/**
 * アイテム名表示。翻訳名を主に、翻訳がある時は英語原文を併記する。
 * inline=true: 同じ行に「翻訳名 原文」/ false(既定): 翻訳名の下に小さく原文。
 */
export function ItemName({
  name,
  nameI18n,
  className,
  inline = false,
}: {
  name: string;
  nameI18n?: NameI18n;
  className?: string;
  inline?: boolean;
}) {
  const { locale } = useT();
  const { display, original } = resolveItemName(name, nameI18n, locale);
  if (!original) return <span className={className}>{display}</span>;
  if (inline) {
    return (
      <span className={className}>
        {display} <span className="text-[0.85em] font-normal text-muted-foreground/70">{original}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      {display}
      <span className="mt-0.5 block text-[0.8em] font-normal leading-tight text-muted-foreground/70">{original}</span>
    </span>
  );
}
