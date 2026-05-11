"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ScoreTable } from "@/components/ScoreTable";
import { ScoreFilters } from "@/components/ScoreFilters";

interface ScoreEntry {
  score: number;
  hits: number;
  totalClicks: number;
  hitRate: number;
  reactionAvg: number | null;
  createdAt: string;
  gridSize: number;
  targetCount: number;
  duration: number;
}

interface FilterCombo {
  gridSize: number;
  targetCount: number;
  duration: number;
}

export default function HistoryPage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [filters, setFilters] = useState<FilterCombo[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterCombo | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    const params = new URLSearchParams({ page: String(page) });
    if (selectedFilter) {
      if (selectedFilter.gridSize) params.set("gridSize", String(selectedFilter.gridSize));
      if (selectedFilter.targetCount) params.set("targetCount", String(selectedFilter.targetCount));
      if (selectedFilter.duration) params.set("duration", String(selectedFilter.duration));
    }

    fetch(`/api/history?${params}`)
      .then((res) => {
        if (id !== fetchIdRef.current) return null;
        if (res.status === 401) {
          setError("请先登录");
          return null;
        }
        if (!res.ok) throw new Error("加载失败");
        return res.json();
      })
      .then((data) => {
        if (id !== fetchIdRef.current || !data) return;
        setScores(data.scores);
        setFilters(data.filters);
        setTotal(data.total);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return;
        setError("加载失败");
        setLoading(false);
      });
  }, [page, selectedFilter]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-lg"
            className="cursor-pointer"
            onClick={() => (window.location.href = "/")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-2xl font-bold">历史成绩</h1>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground mb-4">{error}</div>
              {error === "请先登录" && (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => (window.location.href = "/")}
                >
                  返回首页
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <ScoreFilters
              filters={filters}
              selected={selectedFilter}
              onSelect={(f) => {
                setSelectedFilter(f);
                setPage(1);
              }}
            />

            {loading ? (
              <div className="text-center text-muted-foreground py-8">加载中...</div>
            ) : (
              <>
                <ScoreTable entries={scores} />
                {total > 50 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-muted-foreground py-1">
                      {page} / {Math.ceil(total / 50)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={page * 50 >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
