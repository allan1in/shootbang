import { Card, CardContent } from "@/components/ui/card";

interface ScoreEntry {
  score: number;
  hits: number;
  totalClicks?: number;
  hitRate: number;
  reactionAvg: number | null;
  createdAt: string;
  user?: { email: string };
}

interface ScoreTableProps {
  entries: ScoreEntry[];
  showUser?: boolean;
  showRank?: boolean;
  currentEmail?: string;
}

export function ScoreTable({ entries, showUser, showRank, currentEmail }: ScoreTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无记录
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <Card
          key={i}
          className={currentEmail && entry.user?.email === currentEmail ? "border-primary/50" : ""}
        >
          <CardContent className="py-3 px-4 flex items-center gap-4 text-sm">
            {showRank && (
              <div className="w-8 text-center font-bold text-lg text-primary">
                {i + 1}
              </div>
            )}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <div className="font-bold text-base">{entry.score}</div>
                <div className="text-muted-foreground text-xs">分数</div>
              </div>
              <div>
                <div className="font-bold text-base">{entry.hitRate}%</div>
                <div className="text-muted-foreground text-xs">准确率</div>
              </div>
              <div>
                <div className="font-bold text-base">{entry.hits}</div>
                <div className="text-muted-foreground text-xs">命中</div>
              </div>
              <div>
                <div className="font-bold text-base">
                  {entry.reactionAvg !== null ? `${entry.reactionAvg}ms` : "-"}
                </div>
                <div className="text-muted-foreground text-xs">反应时间</div>
              </div>
            </div>
            {showUser && entry.user && (
              <div className="text-muted-foreground text-xs truncate max-w-[120px]">
                {entry.user.email}
              </div>
            )}
            <div className="text-muted-foreground text-xs whitespace-nowrap">
              {new Date(entry.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
