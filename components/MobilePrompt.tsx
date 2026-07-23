import React from "react";
import { Monitor } from "lucide-react";

export const MobilePrompt = React.memo(function MobilePrompt() {
  return (
    <div className="flex flex-col items-center justify-center h-dvh gap-4 px-6 text-center bg-background">
      <Monitor className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">请使用 PC 端访问</h1>
      <p className="text-muted-foreground max-w-sm">
        需要鼠标和键盘进行操作，暂不支持移动设备
      </p>
    </div>
  );
});
