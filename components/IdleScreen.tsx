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
import { Play, Settings } from "lucide-react";
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
}

export function IdleScreen({
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
}: IdleScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
      {/* 开始 & 设置按钮 */}
      {!showSettings && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-lg"
            className="cursor-pointer border-foreground/10"
            aria-label="开始测试"
            onClick={onStart}
          >
            <Play className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="cursor-pointer border-foreground/10"
            onClick={onOpenSettings}
          >
            <Settings className="size-5" />
          </Button>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <Card className="w-auto">
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
                value={tempSensitivity}
                onChange={(e) =>
                  setTempSensitivity(
                    Math.max(
                      0.01,
                      Math.min(10, parseFloat(e.target.value) || 0.01),
                    ),
                  )
                }
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
}
