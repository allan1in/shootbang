"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
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
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TargetSizeSettings } from "@/components/TargetSizeSettings";
import { CrosshairGraphic } from "@/components/Crosshair";
import type { Theme } from "@/hooks/useTheme";
import {
  CROSSHAIR_LIMITS,
  type CrosshairSettings,
} from "@/lib/crosshair";
import {
  getSensitivityRange,
  isSensitivityMode,
  normalizeSensitivityForMode,
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
  tempCrosshair: CrosshairSettings;
  setTempCrosshair: React.Dispatch<React.SetStateAction<CrosshairSettings>>;
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
  tempCrosshair,
  setTempCrosshair,
  tempTheme,
  setTempTheme,
  tempVolume,
  setTempVolume,
}: SettingsDialogProps) {
  const [sensitivityInput, setSensitivityInput] = useState(
    String(tempSensitivities[tempSensitivityMode]),
  );
  const sensitivityRange = getSensitivityRange(tempSensitivityMode);
  const [inputMode, setInputMode] = useState(tempSensitivityMode);
  const wasOpenRef = useRef(false);
  const [colorPage, setColorPage] = useState(false);
  const [colorDraft, setColorDraft] = useState(tempCrosshair.color);
  const [activeTab, setActiveTab] = useState("training");
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const colorTitleRef = useRef<HTMLButtonElement>(null);
  const returningFromColor = useRef(false);

  const returnToCrosshair = () => {
    returningFromColor.current = true;
    setColorPage(false);
  };

  const discardColorChange = () => {
    setColorDraft(tempCrosshair.color);
    returnToCrosshair();
  };

  const saveColorChange = () => {
    setTempCrosshair((current) => ({ ...current, color: colorDraft }));
    returnToCrosshair();
  };

  const openColorPage = () => {
    setColorDraft(tempCrosshair.color);
    setColorPage(true);
  };

  useEffect(() => {
    if (colorPage) colorTitleRef.current?.focus();
    else if (returningFromColor.current) {
      colorButtonRef.current?.focus();
      returningFromColor.current = false;
    }
  }, [colorPage]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setColorPage(false);
      setColorDraft(tempCrosshair.color);
      setActiveTab("training");
      setSensitivityInput(String(tempSensitivities[tempSensitivityMode]));
      setInputMode(tempSensitivityMode);
    }
    wasOpenRef.current = open;
  }, [open, tempCrosshair.color, tempSensitivities, tempSensitivityMode]);

  useEffect(() => {
    if (tempSensitivityMode !== inputMode) {
      setSensitivityInput(String(tempSensitivities[tempSensitivityMode]));
      setInputMode(tempSensitivityMode);
    }
  }, [inputMode, tempSensitivities, tempSensitivityMode]);

  const commitSensitivity = () => {
    const normalized = normalizeSensitivityForMode(
      tempSensitivityMode,
      Number.parseFloat(sensitivityInput),
    );
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

    const normalized = normalizeSensitivityForMode(
      tempSensitivityMode,
      Number.parseFloat(value),
    );
    if (normalized !== null) {
      setTempSensitivity(tempSensitivityMode, normalized);
    }
  };

  const handleModeChange = (value: SensitivityMode | null) => {
    if (!isSensitivityMode(value) || value === tempSensitivityMode) return;
    commitSensitivity();
    setTempSensitivityMode(value);
  };

  const updateCrosshair = <Key extends keyof CrosshairSettings>(
    key: Key,
    value: CrosshairSettings[Key],
  ) => {
    setTempCrosshair((current) => ({ ...current, [key]: value }));
  };

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && colorPage && details.reason === "escape-key") {
          details.cancel();
          discardColorChange();
        } else if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="w-[22rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto bg-card/60 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex h-4 items-center gap-2">
            {colorPage ? (
              <>
                <button
                  ref={colorTitleRef}
                  type="button"
                  onClick={discardColorChange}
                  className="cursor-pointer rounded-sm text-base leading-none font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  设置
                </button>
                <span className="text-muted-foreground/60">/</span>
                <span>调整颜色</span>
              </>
            ) : "设置"}
          </DialogTitle>
        </DialogHeader>

        {colorPage ? (
          <div className="flex h-[19.625rem] flex-col gap-4">
            <div
              data-crosshair-preview
              className="flex min-h-16 flex-1 items-center justify-center rounded-lg border border-border"
              style={{
                background:
                  "radial-gradient(circle at center, color-mix(in oklch, color-mix(in oklch, var(--muted) 80%, var(--foreground) 20%) 80%, transparent) 0%, color-mix(in oklch, var(--background) 30%, transparent) 100%)",
              }}
            >
              <CrosshairGraphic
                settings={{ ...tempCrosshair, color: colorDraft }}
              />
            </div>
            <ColorPicker
              color={colorDraft}
              onChange={setColorDraft}
            />
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <TabsList
            aria-label="设置分类"
            className="w-full bg-muted/50 group-data-horizontal/tabs:h-9"
          >
            <TabsTrigger value="training">训练</TabsTrigger>
            <TabsTrigger value="crosshair">准星</TabsTrigger>
            <TabsTrigger value="experience">体验</TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="h-[16.375rem] flex-none space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sensitivity">灵敏度</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={tempSensitivityMode}
                  onValueChange={handleModeChange}
                >
                  <SelectTrigger aria-label="游戏" className="w-full min-w-0">
                    <SelectValue>
                      {(value) => {
                        if (value === "valorant") return "无畏契约";
                        if (value === "delta") return "三角洲行动";
                        return "CS2";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs2">CS2</SelectItem>
                    <SelectItem value="valorant">无畏契约</SelectItem>
                    <SelectItem value="delta">三角洲行动</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="sensitivity"
                  aria-label="灵敏度数值"
                  type="number"
                  min={sensitivityRange.min}
                  max={sensitivityRange.max}
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
            value="crosshair"
            className="flex h-[16.375rem] flex-none flex-col gap-4"
          >
            <div
              data-crosshair-preview
              className="flex min-h-16 flex-1 items-center justify-center rounded-lg border border-border"
              style={{
                background:
                  "radial-gradient(circle at center, color-mix(in oklch, color-mix(in oklch, var(--muted) 80%, var(--foreground) 20%) 80%, transparent) 0%, color-mix(in oklch, var(--background) 30%, transparent) 100%)",
              }}
            >
              <CrosshairGraphic settings={tempCrosshair} />
            </div>

            <div className="flex flex-none flex-col gap-4">
              {(
                [
                  ["length", "长度", CROSSHAIR_LIMITS.length],
                  ["thickness", "粗细", CROSSHAIR_LIMITS.thickness],
                  ["gap", "间距", CROSSHAIR_LIMITS.gap],
                ] as const
              ).map(([key, label, limits]) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-8 flex-none">{label}</Label>
                  <Slider
                    value={tempCrosshair[key]}
                    min={limits.min}
                    max={limits.max}
                    step={0.5}
                    onValueChange={(value) => updateCrosshair(key, value)}
                    getAriaLabel={() => `准星${label}`}
                  />
                  <span className="w-7 flex-none text-right text-xs tabular-nums text-muted-foreground">
                    {tempCrosshair[key].toFixed(1)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid flex-none grid-cols-3 gap-2">
              {([
                ["centerDot", "中心点"],
                ["outline", "黑色描边"],
              ] as const).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={tempCrosshair[key] ? "default" : "outline"}
                  aria-pressed={tempCrosshair[key]}
                  onClick={() => updateCrosshair(key, !tempCrosshair[key])}
                  className="w-full"
                >
                  {label}
                </Button>
              ))}
              <Button
                ref={colorButtonRef}
                type="button"
                size="sm"
                variant="outline"
                className="w-full gap-1"
                onClick={openColorPage}
              >
                调整颜色
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
              </Button>
            </div>
          </TabsContent>

          <TabsContent
            value="experience"
            className="flex h-[16.375rem] flex-none flex-col gap-4"
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
        )}

        <DialogFooter className="grid grid-cols-2 pt-0">
          <Button className="w-full" type="button" variant="outline" onClick={colorPage ? discardColorChange : onCancel}>
            取消
          </Button>
          <Button className="w-full" type="button" onClick={colorPage ? saveColorChange : onSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
