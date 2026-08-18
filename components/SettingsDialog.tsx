"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TargetSizeSettings } from "@/components/TargetSizeSettings";
import type { Theme } from "@/hooks/useTheme";
import {
  isSensitivityMode,
  normalizeSensitivity,
  type SensitivityMode,
  type SensitivityValues,
} from "@/lib/sensitivity";

const THEMES: { key: Theme; name: string; description: string }[] = [
  { key: "default", name: "默认", description: "经典网格射击" },
  { key: "thunderstorm", name: "雷雨", description: "闪电会短暂致盲" },
  { key: "blizzard", name: "暴雪", description: "风暴会遮挡视线" },
];

interface SettingsDialogProps {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  tempSensitivityMode: SensitivityMode;
  tempSensitivities: SensitivityValues;
  tempGridSize: number;
  tempDuration: number;
  setTempSensitivityMode: (value: SensitivityMode) => void;
  setTempSensitivity: (mode: SensitivityMode, value: number) => void;
  setTempGridSize: (value: number) => void;
  setTempDuration: (value: number) => void;
  tempTargetSize: string;
  setTempTargetSize: (value: string) => void;
  tempTheme: Theme;
  setTempTheme: (value: Theme) => void;
  tempVolume: number;
  setTempVolume: (value: number) => void;
}

export const SettingsDialog = React.memo(function SettingsDialog({
  open,
  onCancel,
  onSave,
  tempSensitivityMode,
  tempSensitivities,
  tempGridSize,
  tempDuration,
  setTempSensitivityMode,
  setTempSensitivity,
  setTempGridSize,
  setTempDuration,
  tempTargetSize,
  setTempTargetSize,
  tempTheme,
  setTempTheme,
  tempVolume,
  setTempVolume,
}: SettingsDialogProps) {
  const [sensitivityInput, setSensitivityInput] = useState(
    String(tempSensitivities[tempSensitivityMode]),
  );
  const [inputMode, setInputMode] = useState(tempSensitivityMode);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSensitivityInput(String(tempSensitivities[tempSensitivityMode]));
      setInputMode(tempSensitivityMode);
    }
    wasOpenRef.current = open;
  }, [open, tempSensitivities, tempSensitivityMode]);

  useEffect(() => {
    if (tempSensitivityMode !== inputMode) {
      setSensitivityInput(String(tempSensitivities[tempSensitivityMode]));
      setInputMode(tempSensitivityMode);
    }
  }, [inputMode, tempSensitivities, tempSensitivityMode]);

  const commitSensitivity = () => {
    const normalized = normalizeSensitivity(Number.parseFloat(sensitivityInput));
    if (normalized === null) {
      setSensitivityInput(String(tempSensitivities[tempSensitivityMode]));
      return;
    }

    setSensitivityInput(String(normalized));
    setTempSensitivity(tempSensitivityMode, normalized);
  };

  const handleSensitivityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!/^\d*(?:\.\d{0,3})?$/.test(value)) return;
    setSensitivityInput(value);

    const normalized = normalizeSensitivity(Number.parseFloat(value));
    if (normalized !== null) {
      setTempSensitivity(tempSensitivityMode, normalized);
    }
  };

  const handleModeChange = (value: SensitivityMode | null) => {
    if (!isSensitivityMode(value) || value === tempSensitivityMode) return;
    commitSensitivity();
    setTempSensitivityMode(value);
  };

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="w-[22rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto bg-card/60 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="training" className="gap-4">
          <TabsList
            aria-label="设置分类"
            className="w-full bg-muted/50 group-data-horizontal/tabs:h-9"
          >
            <TabsTrigger value="training">训练</TabsTrigger>
            <TabsTrigger value="experience">体验</TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="h-[16.5rem] flex-none space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sensitivity">灵敏度</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={tempSensitivityMode}
                  onValueChange={handleModeChange}
                >
                  <SelectTrigger aria-label="游戏" className="w-full min-w-0">
                    <SelectValue>
                      {(value) => value === "valorant" ? "无畏契约" : "CS2"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs2">CS2</SelectItem>
                    <SelectItem value="valorant">无畏契约</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="sensitivity"
                  aria-label="灵敏度数值"
                  type="number"
                  min={0.01}
                  max={10}
                  step={0.001}
                  value={sensitivityInput}
                  onChange={handleSensitivityChange}
                  onBlur={commitSensitivity}
                  className="h-9 min-w-0 w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>游戏时长</Label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={tempDuration === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTempDuration(value)}
                  >
                    {value}s
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>网格大小</Label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={tempGridSize === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTempGridSize(value)}
                  >
                    {value}x{value}
                  </Button>
                ))}
              </div>
            </div>

            <TargetSizeSettings
              value={tempTargetSize}
              onChange={setTempTargetSize}
            />
          </TabsContent>

          <TabsContent
            value="experience"
            className="flex h-[16.5rem] flex-none flex-col gap-4"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <Label>主题</Label>
              <RadioGroup
                value={tempTheme}
                onValueChange={(value) => setTempTheme(value as Theme)}
                aria-label="主题"
                className="min-h-0 flex-1 grid-rows-3"
              >
                {THEMES.map((theme) => (
                  <label
                    key={theme.key}
                    className="flex h-full cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <RadioGroupItem value={theme.key} aria-label={theme.name} />
                    <span>
                      <span className="block text-sm font-medium">{theme.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {theme.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex-none space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label>音量</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {tempVolume}%
                </span>
              </div>
              <Slider
                value={tempVolume}
                min={0}
                max={100}
                step={1}
                onValueChange={setTempVolume}
                getAriaLabel={() => "音量"}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="grid grid-cols-2">
          <Button className="w-full" type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button className="w-full" type="button" onClick={onSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
