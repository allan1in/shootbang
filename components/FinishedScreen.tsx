import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface FinishedScreenProps {
  score: number;
  hits: number;
  hitRate: number;
  reactionAvg: number | null;
  isNewBest: boolean;
  onRestart: () => void;
  onGoHome: () => void;
}

export function FinishedScreen({
  score,
  hits,
  hitRate,
  reactionAvg,
  isNewBest,
  onRestart,
  onGoHome,
}: FinishedScreenProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 cursor-default">
      <Card className="w-80">
        <CardContent className="space-y-6">
          <div className="relative text-center">
            <div className="text-5xl font-bold text-primary">{score}</div>
            <div className="text-sm text-muted-foreground mt-1">总分</div>
            {isNewBest && (
              <div className="absolute -bottom-5 left-0 right-0 text-sm text-yellow-500 font-semibold">
                新纪录!
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-foreground">{hits}</div>
              <div className="text-sm text-muted-foreground mt-1">命中数</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">
                {hitRate}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">准确率</div>
            </div>
          </div>
          {reactionAvg !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {reactionAvg}ms
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                平均反应时间
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            variant="outline"
            className="flex-1 cursor-pointer border-foreground/10"
            onClick={onRestart}
          >
            再来一局
          </Button>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer border-foreground/10"
            onClick={onGoHome}
          >
            返回首页
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
