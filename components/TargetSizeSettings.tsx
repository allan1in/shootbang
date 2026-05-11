import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SIZES = [
  { value: "tiny", label: "极小" },
  { value: "small", label: "小" },
  { value: "default", label: "默认" },
  { value: "large", label: "大" },
  { value: "huge", label: "极大" },
];

interface TargetSizeSettingsProps {
  value: string;
  onChange: (v: string) => void;
}

export function TargetSizeSettings({ value, onChange }: TargetSizeSettingsProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">目标大小</Label>
      <div className="flex gap-2">
        {SIZES.map((s) => (
          <Button
            key={s.value}
            variant={value === s.value ? "default" : "outline"}
            size="sm"
            className="flex-1 cursor-pointer"
            onClick={() => onChange(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
