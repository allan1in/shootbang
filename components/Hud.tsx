import { Card } from "@/components/ui/card";

interface HudProps {
  score: number;
  timeLeft: number;
  hitRate: number;
}

export function Hud({ score, timeLeft, hitRate }: HudProps) {
  return (
    <div className="absolute top-4 left-0 right-0 z-10 flex justify-center gap-4 pointer-events-none">
      <Card className="w-36 text-center">
        <span className="text-muted-foreground text-sm">分数</span>
        <div className="text-3xl font-bold text-foreground">{score}</div>
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
