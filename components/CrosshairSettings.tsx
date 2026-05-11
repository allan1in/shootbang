import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SIZES = [16, 20, 24, 32, 40];

const STYLES = [
  { value: "cross", label: "十字" },
  { value: "square", label: "方点" },
  { value: "dot", label: "圆点" },
];

interface CrosshairSettingsProps {
  size: number;
  style: string;
  onSizeChange: (v: number) => void;
  onStyleChange: (v: string) => void;
}

export function CrosshairSettings({
  size,
  style,
  onSizeChange,
  onStyleChange,
}: CrosshairSettingsProps) {
  const color = "#ffffff";

  return (
    <div className="space-y-3">
      <Label className="text-sm">准星样式</Label>
      <div className="flex gap-2">
        {STYLES.map((s) => (
          <Button
            key={s.value}
            variant={style === s.value ? "default" : "outline"}
            size="sm"
            className="flex-1 cursor-pointer"
            onClick={() => onStyleChange(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Label className="text-sm">准星大小</Label>
      <div className="flex gap-2">
        {SIZES.map((s) => (
          <Button
            key={s}
            variant={size === s ? "default" : "outline"}
            size="sm"
            className="flex-1 cursor-pointer"
            onClick={() => onSizeChange(s)}
          >
            {s}px
          </Button>
        ))}
      </div>

      {/* 预览 */}
      <div className="flex items-center justify-center h-16 bg-foreground/5 rounded-md">
        <div className="relative" style={{ width: size, height: size }}>
          {style === "cross" && (
            <>
              <div
                className="absolute left-1/2 top-1/2"
                style={{
                  width: size,
                  height: 2,
                  backgroundColor: color,
                  opacity: 0.7,
                  transform: `translate(-${size / 2}px, -1px)`,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2"
                style={{
                  width: 2,
                  height: size,
                  backgroundColor: color,
                  opacity: 0.7,
                  transform: `translate(-1px, -${size / 2}px)`,
                }}
              />
            </>
          )}
          {style === "square" && (
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: size * 0.3,
                height: size * 0.3,
                backgroundColor: color,
                opacity: 0.8,
                transform: `translate(-${size * 0.15}px, -${size * 0.15}px)`,
              }}
            />
          )}
          {style === "dot" && (
            <div
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: size * 0.3,
                height: size * 0.3,
                backgroundColor: color,
                opacity: 0.8,
                transform: `translate(-${size * 0.15}px, -${size * 0.15}px)`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
