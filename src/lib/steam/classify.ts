/**
 * Steam の market_hash_name から実ファセット(type/part/grade/classType/level)を推定する。
 * grade/part/type は名前から高精度に判定。class/level は名前にヒントが無ければ hash で決定論的に割当
 * (本番では fetchFacetTags で実タグに上書きできる)。
 */
import type { ItemType, Part, Grade, ClassType } from "@prisma/client";

export interface ClassifiedAttrs {
  type: ItemType;
  part: Part;
  grade: Grade;
  classType: ClassType;
  level: number | null;
}

// 括弧内レアリティ -> Grade
const RARITY: Record<string, Grade> = {
  Common: "COMMON", Uncommon: "UNCOMMON", Rare: "RARE", Legendary: "LEGENDARY",
  Arcana: "ARCANA", Immortal: "IMMORTAL", Beyond: "BEYOND", Divine: "DIVINE",
  Celestial: "CELESTIAL", Cosmic: "COSMIC",
};

export function classify(name: string): ClassifiedAttrs {
  const rm = name.match(/\(([^)]+)\)/);
  const isGear = !!(rm && RARITY[rm[1]]);

  if (!isGear) {
    return { type: "MATERIAL", part: "NONE", grade: "COMMON", classType: "NONE", level: null };
  }

  const grade = RARITY[rm![1]];

  let part: Part = "MAIN_WEAPON";
  // サブ武器(オフハンド/弾): 盾・魔道書・宝珠・矢/ボルトなど。先に判定する。
  if (/shield|buckler|tome|orb|grimoire|quiver|arrow|bolt/i.test(name)) part = "SUB_WEAPON";
  else if (/sword|hatchet|axe|blade|dagger|spear|bow|crossbow|staff|scepter|wand|mace|hammer|lance|katana/i.test(name)) part = "MAIN_WEAPON";
  else if (/helmet|helm|cap|crown|hood|mask/i.test(name)) part = "HELMET";
  else if (/gloves|gauntlet|fist/i.test(name)) part = "GLOVES";
  else if (/boots|greaves|sabaton|shoes/i.test(name)) part = "BOOTS";
  else if (/armor|armour|mail|plate|robe|cuirass|vest|cloak/i.test(name)) part = "ARMOR";
  else if (/bracer|bracelet|vambrace|wrist/i.test(name)) part = "BRACER";
  else if (/amulet|necklace|pendant/i.test(name)) part = "AMULET";
  else if (/earring|earing/i.test(name)) part = "EARRING";
  else if (/ring/i.test(name)) part = "RING";

  // クラスは武器(メイン/サブ)で名前から判別できる時だけ。判別不能や防具/装飾は NONE。
  // ※ 以前はハッシュで適当なクラスを当てていたが、実物と食い違うため廃止。
  let classType: ClassType = "NONE";
  if (part === "MAIN_WEAPON" || part === "SUB_WEAPON") {
    if (/priest|cleric|holy|sacred/i.test(name)) classType = "PRIEST";
    else if (/hunter/i.test(name)) classType = "HUNTER";
    else if (/ranger|bow|arrow/i.test(name)) classType = "RANGER";
    else if (/sorcer|mage|wizard|arcane|staff|scepter|tome|orb|wand/i.test(name)) classType = "SORCERER";
    else if (/knight|guard|fighter|warrior|sword|lance/i.test(name)) classType = "KNIGHT";
    else if (/slayer|assassin|rogue|dagger/i.test(name)) classType = "SLAYER";
  }

  // レベルは捏造しない。名前に "Lv. N" があれば採用し、無ければ null。
  // 実レベルは説明文の "Requires Lv." を refreshDescriptions が Item.level へ反映する。
  const lvMatch = name.match(/Lv\.?\s*(\d+)/i);
  const level = lvMatch ? parseInt(lvMatch[1], 10) : null;
  return { type: "GEAR", part, grade, classType, level };
}

/**
 * Steam の価格文字列を最小通貨単位の整数へ変換する。
 *   JPY(fraction 0): "¥ 1,646" -> 1646 / "¥ 10.58" -> 11(四捨五入)
 *   USD(fraction 2): "$1.23" -> 123
 */
export function parseSteamPrice(raw: string | null | undefined, fractionDigits: number): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;

  if (fractionDigits === 0) {
    // 小数があれば四捨五入、なければ区切りを除去して整数
    if (/[.,]\d{1,2}$/.test(cleaned)) {
      const norm = cleaned.replace(/,/g, (m, i) => (i === cleaned.length - 3 ? "." : "")).replace(/[^0-9.]/g, "");
      return Math.round(parseFloat(norm));
    }
    const n = parseInt(cleaned.replace(/[.,]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decPos = Math.max(lastDot, lastComma);
  let intPart = cleaned;
  let fracPart = "";
  if (decPos >= 0) {
    intPart = cleaned.slice(0, decPos);
    fracPart = cleaned.slice(decPos + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  fracPart = (fracPart + "0".repeat(fractionDigits)).slice(0, fractionDigits);
  const n = parseInt(intPart + fracPart, 10);
  return Number.isFinite(n) ? n : null;
}
