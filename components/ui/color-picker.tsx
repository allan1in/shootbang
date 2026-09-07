"use client";

import { useId, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./color-picker.module.css";

const CHANNELS = ["R", "G", "B"] as const;

function toChannels(color: string) {
  return CHANNELS.map((_, index) =>
    Number.parseInt(color.slice(1 + index * 2, 3 + index * 2), 16),
  );
}

function RgbInputs({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const id = useId();
  const channels = toChannels(color);
  const [draft, setDraft] = useState<{ index: number; value: string } | null>(null);

  const updateChannel = (index: number, raw: string) => {
    if (!/^\d{0,3}$/.test(raw)) return;
    setDraft({ index, value: raw });
    if (raw === "") return;
    const next = [...channels];
    next[index] = Math.min(255, Number(raw));
    onChange(`#${next.map((value) => value.toString(16).padStart(2, "0")).join("")}`);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {CHANNELS.map((channel, index) => (
        <div key={channel} className="flex min-w-0 items-center gap-2">
          <Label
            htmlFor={`${id}-${channel}`}
            className="text-xs text-muted-foreground"
          >
            {channel}
          </Label>
          <Input
            id={`${id}-${channel}`}
            aria-label={`准星颜色 ${channel}`}
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={draft?.index === index ? draft.value : channels[index]}
            onChange={(event) => updateChannel(index, event.target.value)}
            onBlur={() => setDraft(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setDraft(null);
              }
            }}
            className="h-8 px-1.5 text-center text-xs tabular-nums md:text-xs"
          />
        </div>
      ))}
    </div>
  );
}

export function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex-none space-y-4" aria-label="准星调色板">
      <HexColorPicker color={color} onChange={onChange} className={styles.picker} />
      <RgbInputs color={color} onChange={onChange} />
    </div>
  );
}
