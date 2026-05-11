import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface HudProps {
  score: number;
  timeLeft: number;
  hitRate: number;
  streak: number;
  floatingScores: { id: number; value: number }[];
}

function FloatingScore({ score, onDone }: { score: number; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 1200);
    return () => clearTimeout(timer);
  }, [onDone]);

  const color = score >= 120 ? "text-yellow-400" : score >= 80 ? "text-white" : "text-muted-foreground";

  return (
    <div
      className={`absolute left-1/2 top-1/3 -translate-x-1/2 text-2xl font-bold pointer-events-none transition-all duration-300 ${color} ${
        visible ? "opacity-100 -translate-y-4" : "opacity-0 -translate-y-12"
      }`}
    >
      +{score}
    </div>
  );
}

export function Hud({ score, timeLeft, hitRate, streak, floatingScores }: HudProps) {
  return (
    <div className="absolute top-4 left-0 right-0 z-10 flex justify-center gap-4 pointer-events-none">
      <Card className="w-36 text-center relative">
        <span className="text-muted-foreground text-sm">分数</span>
        <div className="text-3xl font-bold text-foreground">{score}</div>
        {streak >= 3 && (
          <div className="text-xs text-yellow-500 font-medium">连击 x{streak}</div>
        )}
        {floatingScores.map((fs) => (
          <FloatingScore
            key={fs.id}
            score={fs.value}
            onDone={() => {}}
          />
        ))}
      </Card>
      <Card className="w-36 text-center">
        <span className="text-muted-foreground text-sm">时间</span>
        <div className="text-3xl font-bold text-foreground">{timeLeft}s</div>
      </Card>
      <Card className="w-36 text-center">
        <span className="text-muted-foreground text-sm">准确率</span>
        <div className="text-3xl font-bold text-primary">{hitRate}%</div>
      </Card>
    </div>
  );
}
