import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Play, Settings, Palette, Volume2, VolumeX } from "lucide-react";
import { TargetSizeSettings } from "@/components/TargetSizeSettings";

interface IdleScreenProps {
  showSettings: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
  onCancelSettings: () => void;
  onSaveSettings: () => void;
  tempSensitivity: number;
  tempGridSize: number;
  tempDuration: number;
  setTempSensitivity: (v: number) => void;
  setTempGridSize: (v: number) => void;
  setTempDuration: (v: number) => void;
  tempTargetSize: string;
  setTempTargetSize: (v: string) => void;
  showThemePanel: boolean;
  onOpenTheme: () => void;
  onCancelTheme: () => void;
  onSaveTheme: () => void;
  tempTheme: "default" | "thunderstorm" | "blizzard";
  setTempTheme: (v: "default" | "thunderstorm" | "blizzard") => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const IdleScreen = React.memo(function IdleScreen({
  showSettings,
  onStart,
  onOpenSettings,
  onCancelSettings,
  onSaveSettings,
  tempSensitivity,
  tempGridSize,
  tempDuration,
  setTempSensitivity,
  setTempGridSize,
  setTempDuration,
  tempTargetSize,
  setTempTargetSize,
  showThemePanel,
  onOpenTheme,
  onCancelTheme,
  onSaveTheme,
  tempTheme,
  setTempTheme,
  muted,
  onToggleMute,
}: IdleScreenProps) {
  const [sensitivityInput, setSensitivityInput] = useState(String(tempSensitivity));
  const [prevSensitivity, setPrevSensitivity] = useState(tempSensitivity);

  useEffect(() => {
    if (tempSensitivity !== prevSensitivity) {
      setSensitivityInput(String(tempSensitivity));
      setPrevSensitivity(tempSensitivity);
    }
  }, [tempSensitivity, prevSensitivity]);

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const dotIndex = val.indexOf(".");
    if (dotIndex !== -1 && val.length - dotIndex > 3) return;
    setSensitivityInput(val);
  };

  const handleSensitivityBlur = () => {
    const parsed = parseFloat(sensitivityInput);
    if (isNaN(parsed) || parsed < 0.01) {
      setSensitivityInput(String(prevSensitivity));
      setTempSensitivity(prevSensitivity);
    } else {
      const clamped = Math.min(10, parsed);
      const rounded = Math.round(clamped * 100) / 100;
      setSensitivityInput(String(rounded));
      setTempSensitivity(rounded);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
      {/* 开始 & 设置按钮 */}
      {!showSettings && !showThemePanel && (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-bold tracking-tight">Shootbang</h1>
          <p className="text-base text-muted-foreground">在限定时间内尽可能多地命中目标</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onStart}>
              <Play data-icon="inline-start" className="size-4" />
              开始
            </Button>
            <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onOpenSettings}>
              <Settings data-icon="inline-start" className="size-4" />
              设置
            </Button>
            <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onOpenTheme}>
              <Palette data-icon="inline-start" className="size-4" />
              主题
            </Button>
            <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onToggleMute}>
              {muted ? <VolumeX data-icon="inline-start" className="size-4" /> : <Volume2 data-icon="inline-start" className="size-4" />}
              {muted ? "取消静音" : "静音"}
            </Button>
          </div>
        </div>
      )}

      {/* 主题面板 */}
      {showThemePanel && (
        <Card className="w-auto min-w-64">
          <CardHeader>
            <CardTitle>主题</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              { key: "default" as const, name: "默认", desc: "经典网格" },
              { key: "thunderstorm" as const, name: "雷暴", desc: "小心闪电" },
              { key: "blizzard" as const, name: "暴雪", desc: "寒风呼啸" },
            ]).map((t) => (
              <button
                key={t.key}
                className="w-full flex items-center gap-3 rounded-md border border-foreground/10 px-3 py-2 text-left cursor-pointer transition-colors hover:bg-accent"
                onClick={() => setTempTheme(t.key)}
              >
                <div className={`size-4 rounded-full border-2 shrink-0 flex items-center justify-center ${tempTheme === t.key ? "border-primary" : "border-muted-foreground/30"}`}>
                  {tempTheme === t.key && <div className="size-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </button>
            ))}
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer border-foreground/10"
              onClick={onCancelTheme}
            >
              取消
            </Button>
            <Button
              variant="outline"
              className="flex-1 cursor-pointer border-foreground/10"
              onClick={onSaveTheme}
            >
              保存
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <Card className="w-auto min-w-64">
          <CardHeader>
            <CardTitle>设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">灵敏度</Label>
              <Input
                type="number"
                min={0.01}
                max={10}
                step={0.01}
                value={sensitivityInput}
                onChange={handleSensitivityChange}
                onBlur={handleSensitivityBlur}
                className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">游戏时长</Label>
              <div className="flex gap-2">
                {[15, 30, 60, 120].map((v) => (
                  <Button
                    key={v}
                    variant={tempDuration === v ? "default" : "outline"}
                    size="sm"
                    className="flex-1 cursor-pointer"
                    onClick={() => setTempDuration(v)}
                  >
                    {v}s
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">网格大小</Label>
              <div className="flex gap-2">
                {[3, 4, 5, 6].map((v) => (
                  <Button
                    key={v}
                    variant={tempGridSize === v ? "default" : "outline"}
                    size="sm"
                    className="flex-1 cursor-pointer"
                    onClick={() => setTempGridSize(v)}
                  >
                    {v}x{v}
                  </Button>
                ))}
              </div>
            </div>
            <TargetSizeSettings
              value={tempTargetSize}
              onChange={setTempTargetSize}
            />
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer border-foreground/10"
              onClick={onCancelSettings}
            >
              取消
            </Button>
            <Button
              variant="outline"
              className="flex-1 cursor-pointer border-foreground/10"
              onClick={onSaveSettings}
            >
              保存
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
});
