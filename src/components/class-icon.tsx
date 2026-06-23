/**
 * クラスアイコン (Knight/Slayer/Hunter/Ranger/Sorcerer/Priest)。
 * 画像は public/classes/*.png (同一オリジン・CSP img-src 'self' で許可)。
 * NONE / 不明クラスは何も描画しない。
 */
const CLASS_ICONS: Record<string, string> = {
  KNIGHT: "/classes/knight.png",
  SLAYER: "/classes/slayer.png",
  HUNTER: "/classes/hunter.png",
  RANGER: "/classes/ranger.png",
  SORCERER: "/classes/sorcerer.png",
  PRIEST: "/classes/priest.png",
};

export function classIconSrc(classType: string): string | null {
  return CLASS_ICONS[classType] ?? null;
}

export function ClassIcon({
  classType,
  size = 18,
  className = "",
}: {
  classType: string;
  size?: number;
  className?: string;
}) {
  const src = classIconSrc(classType);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={classType}
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
