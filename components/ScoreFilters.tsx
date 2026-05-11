import { Button } from "@/components/ui/button";

interface FilterCombo {
  gridSize: number;
  targetCount: number;
  duration: number;
}

interface ScoreFiltersProps {
  filters: FilterCombo[];
  selected: FilterCombo | null;
  onSelect: (f: FilterCombo | null) => void;
}

export function ScoreFilters({ filters, selected, onSelect }: ScoreFiltersProps) {
  if (filters.length === 0) return null;

  const uniqueDurations = [...new Set(filters.map((f) => f.duration))].sort((a, b) => a - b);
  const uniqueGrids = [...new Set(filters.map((f) => f.gridSize))].sort((a, b) => a - b);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selected === null ? "default" : "outline"}
          size="sm"
          className="cursor-pointer"
          onClick={() => onSelect(null)}
        >
          全部
        </Button>
        {uniqueDurations.map((d) => (
          <Button
            key={`d-${d}`}
            variant={selected?.duration === d && !selected?.gridSize ? "default" : "outline"}
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              const match = filters.find((f) => f.duration === d);
              if (match) onSelect({ gridSize: 0, targetCount: 0, duration: d });
            }}
          >
            {d}s
          </Button>
        ))}
        {uniqueGrids.map((g) => (
          <Button
            key={`g-${g}`}
            variant={selected?.gridSize === g && selected?.duration === 0 ? "default" : "outline"}
            size="sm"
            className="cursor-pointer"
            onClick={() => onSelect({ gridSize: g, targetCount: 0, duration: 0 })}
          >
            {g}x{g}
          </Button>
        ))}
      </div>
    </div>
  );
}
