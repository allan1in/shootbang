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
import { Settings, LogOut, User as UserIcon, History, Trophy } from "lucide-react";
import { CrosshairSettings } from "@/components/CrosshairSettings";
import { TargetSizeSettings } from "@/components/TargetSizeSettings";

interface AuthUser {
  id: number;
  email: string;
}

interface IdleScreenProps {
  showSettings: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
  onCancelSettings: () => void;
  onSaveSettings: () => void;
  // 设置临时值
  tempSensitivity: number;
  tempGridSize: number;
  tempTargetCount: number;
  tempDuration: number;
  setTempSensitivity: (v: number) => void;
  setTempGridSize: (v: number) => void;
  setTempTargetCount: (v: number) => void;
  setTempDuration: (v: number) => void;
  // 准星/目标设置
  tempCrosshairSize: number;
  tempCrosshairStyle: string;
  tempTargetSize: string;
  setTempCrosshairSize: (v: number) => void;
  setTempCrosshairStyle: (v: string) => void;
  setTempTargetSize: (v: string) => void;
  // 用户
  user: AuthUser | null;
  onLogout: () => void;
  onShowAuth: () => void;
}

export function IdleScreen({
  showSettings,
  onStart,
  onOpenSettings,
  onCancelSettings,
  onSaveSettings,
  tempSensitivity,
  tempGridSize,
  tempTargetCount,
  tempDuration,
  setTempSensitivity,
  setTempGridSize,
  setTempTargetCount,
  setTempDuration,
  tempCrosshairSize,
  tempCrosshairStyle,
  tempTargetSize,
  setTempCrosshairSize,
  setTempCrosshairStyle,
  setTempTargetSize,
  user,
  onLogout,
  onShowAuth,
}: IdleScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 cursor-default">
      {/* 设置按钮 */}
      {!showSettings && (
        <Button
          variant="ghost"
          size="icon-lg"
          className="absolute top-4 left-4 z-10 cursor-pointer"
          onClick={onOpenSettings}
        >
          <Settings className="size-5" />
        </Button>
      )}

      {/* 用户按钮 */}
      {!showSettings && (
        <div className="absolute top-4 right-4 z-10">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate max-w-[160px]">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="icon-lg"
                className="cursor-pointer"
                onClick={onLogout}
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon-lg"
              className="cursor-pointer"
              onClick={onShowAuth}
            >
              <UserIcon className="size-5" />
            </Button>
          )}
        </div>
      )}

      {/* 开始测试按钮 */}
      {!showSettings && (
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            className="cursor-pointer border-foreground/10 text-base"
            onClick={onStart}
          >
            开始测试
          </Button>
          <div className="flex gap-2">
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-muted-foreground"
                onClick={() => (window.location.href = "/history")}
              >
                <History className="size-4 mr-1" />
                历史成绩
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={() => (window.location.href = "/leaderboard")}
            >
              <Trophy className="size-4 mr-1" />
              排行榜
            </Button>
          </div>
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
                    onClick={() => {
                      setTempGridSize(v);
                      const maxTargets = Math.min(v * v - 1, 6);
                      if (tempTargetCount > maxTargets)
                        setTempTargetCount(maxTargets);
                    }}
                  >
                    {v}x{v}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">同时目标数</Label>
              <div className="flex gap-2">
                {Array.from(
                  { length: Math.min(tempGridSize * tempGridSize - 1, 6) },
                  (_, i) => i + 1,
                ).map((v) => (
                  <Button
                    key={v}
                    variant={tempTargetCount === v ? "default" : "outline"}
                    size="sm"
                    className="flex-1 cursor-pointer"
                    onClick={() => setTempTargetCount(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <TargetSizeSettings
              value={tempTargetSize}
              onChange={setTempTargetSize}
            />
            <CrosshairSettings
              size={tempCrosshairSize}
              style={tempCrosshairStyle}
              onSizeChange={setTempCrosshairSize}
              onStyleChange={setTempCrosshairStyle}
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
