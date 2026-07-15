import React from "react";
import { Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IdleScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
}

export const IdleScreen = React.memo(function IdleScreen({
  onStart,
  onOpenSettings,
}: IdleScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex cursor-default items-center justify-center bg-background/50">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Shootbang</h1>
        <p className="text-base text-muted-foreground">在限定时间内尽可能多地命中目标</p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="cursor-pointer border-foreground/10"
            onClick={onStart}
          >
            <Play data-icon="inline-start" className="size-4" />
            开始
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer border-foreground/10"
            onClick={onOpenSettings}
          >
            <Settings data-icon="inline-start" className="size-4" />
            设置
          </Button>
        </div>
      </div>
    </div>
  );
});
