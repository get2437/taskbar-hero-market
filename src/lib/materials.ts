/**
 * 素材まとめ表のデータ層。assets/materials.json (静的・コミット済) を読むだけなのでDB不要。
 * データ生成は scripts/build-materials.mjs (wiki=tbhwiki.org + Steam出品ページ由来)。
 */
import raw from "../../assets/materials.json";

export type MaterialCategory = "DECORATION" | "ENGRAVING" | "INSCRIPTION" | "CRAFTING" | "ANNIVERSARY" | "SOULSTONE";
export type EffectTarget = "WEAPON" | "ARMOR" | "ACCESSORY" | "ANY";

export interface MaterialEffect {
  target: EffectTarget;
  tier: number | null;
  statKey: string;
  label: string;
  value: string; // 表示用 (例 "+9~10%")
  source: "steam" | "wiki";
}
export interface Material {
  name: string;
  category: MaterialCategory;
  rarity: string;
  slug: string;
  wikiImage: string;
  steamIcon: string | null;
  refPriceYen: number | null;
  onMarket: boolean;
  effects: MaterialEffect[];
  craftLevel?: string; // 製作素材の使用レベル (手動データ)
  coinOutput?: { rarity: string; pct: number | null; note?: string }[]; // 記念コイン使用時の出力分布 (手動データ)
  coinNote?: string; // 記念コインの補足 (例: アルカナ等級以上)
  unreleased?: boolean; // 未実装(データ採掘の先行項目・入手不可)
}

export const MATERIALS = raw as Material[];

export function getMaterials(): Material[] {
  return MATERIALS;
}

// 画像: ローカルにDL済の wiki アイコンを使う (全件あり)。
export function materialImage(m: Pick<Material, "slug">): string {
  return `/materials/${m.slug}.png`;
}
