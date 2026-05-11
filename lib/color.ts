/**
 * 将 CSS 变量（OKLCH 格式）转换为 Three.js 可用的十六进制颜色值
 */
export function varToHex(cs: CSSStyleDeclaration, name: string): number {
  const raw = cs.getPropertyValue(name).trim();
  const m = raw.match(
    /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+%?)\)/,
  );
  if (m) {
    const L = parseFloat(m[1]);
    const a = parseFloat(m[2]);
    const angle = parseFloat(m[3]);
    const h = (angle * Math.PI) / 180;
    const lr = L ** 3;
    const r =
      lr + 0.3963377774 * a * Math.cos(h) + 0.2158037573 * a * Math.sin(h);
    const g =
      lr - 0.1055613458 * a * Math.cos(h) - 0.0638541728 * a * Math.sin(h);
    const b =
      lr - 0.0894841775 * a * Math.cos(h) - 1.291485548 * a * Math.sin(h);
    const toSRGB = (x: number) =>
      Math.round(
        Math.min(
          1,
          Math.max(
            0,
            x <= 0.0031308
              ? 12.92 * x
              : 1.055 * Math.pow(x, 1 / 2.4) - 0.055,
          ),
        ) * 255,
      );
    return (toSRGB(r) << 16) | (toSRGB(g) << 8) | toSRGB(b);
  }
  return 0x111111;
}
