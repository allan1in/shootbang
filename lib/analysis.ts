export interface ShotLogEntry {
  offsetX: number;
  offsetY: number;
  reactionTime: number;
  points: number;
  timestamp: number;
  hit: boolean;
  precisionPts: number;
  reactionPts: number;
  streakMultiplier: number;
  difficultyMultiplier: number;
  streak: number;
}

export interface ScoreBreakdown {
  precisionTotal: number;
  reactionTotal: number;
  streakBonus: number;
  difficultyBonus: number;
}

export interface StreakData {
  max: number;
  avg: number;
  totalStreaks: number;
  longestGap: number;
  timeline: { hit: boolean; streakLen: number }[];
}

export interface PrecisionPoint {
  index: number;
  precision: number;
  avg: number;
}

export interface AnalysisResult {
  streakData: StreakData;
  reactionTrend: { index: number; value: number }[];
  precisionTrend: PrecisionPoint[];
  suggestions: string[];
  avgOffsetX: number;
  avgOffsetY: number;
  stdDevX: number;
  stdDevY: number;
}

export function analyzePerformance(shotLog: ShotLogEntry[]): AnalysisResult {
  const hits = shotLog.filter((s) => s.hit);

  return {
    streakData: computeStreaks(shotLog),
    reactionTrend: computeReactionTrend(hits),
    precisionTrend: computePrecisionTrend(hits),
    suggestions: computeSuggestions(shotLog, hits),
    avgOffsetX: avg(hits.map((h) => h.offsetX)),
    avgOffsetY: avg(hits.map((h) => h.offsetY)),
    stdDevX: stdDev(hits.map((h) => h.offsetX)),
    stdDevY: stdDev(hits.map((h) => h.offsetY)),
  };
}

export function computeScoreBreakdown(shotLog: ShotLogEntry[]): ScoreBreakdown {
  const hits = shotLog.filter((s) => s.hit);
  if (hits.length === 0) {
    return { precisionTotal: 0, reactionTotal: 0, streakBonus: 0, difficultyBonus: 0 };
  }

  let precisionTotal = 0;
  let reactionTotal = 0;
  let baseTotal = 0;
  let finalTotal = 0;

  for (const h of hits) {
    precisionTotal += h.precisionPts;
    reactionTotal += h.reactionPts;
    const base = h.precisionPts + h.reactionPts;
    baseTotal += base;
    finalTotal += h.points;
  }

  const multipliedTotal = baseTotal > 0 ? Math.round(baseTotal * avg(hits.map((h) => h.streakMultiplier * h.difficultyMultiplier))) : 0;
  const streakBonus = Math.round(multipliedTotal - baseTotal);
  const difficultyBonus = finalTotal - multipliedTotal;

  return {
    precisionTotal,
    reactionTotal,
    streakBonus: Math.max(0, streakBonus),
    difficultyBonus: Math.max(0, difficultyBonus),
  };
}

function computeStreaks(shotLog: ShotLogEntry[]): StreakData {
  if (shotLog.length === 0) return { max: 0, avg: 0, totalStreaks: 0, longestGap: 0, timeline: [] };

  const streaks: number[] = [];
  const gaps: number[] = [];
  let current = 0;
  let gapStart = -1;
  const timeline: { hit: boolean; streakLen: number }[] = [];

  for (const shot of shotLog) {
    if (shot.hit) {
      current++;
      if (gapStart >= 0) {
        gaps.push(current - gapStart);
        gapStart = -1;
      }
      timeline.push({ hit: true, streakLen: current });
    } else {
      if (current > 0) streaks.push(current);
      current = 0;
      gapStart = timeline.length;
      timeline.push({ hit: false, streakLen: 0 });
    }
  }
  if (current > 0) streaks.push(current);

  return {
    max: streaks.length > 0 ? Math.max(...streaks) : 0,
    avg: streaks.length > 0 ? Math.round(avg(streaks)) : 0,
    totalStreaks: streaks.length,
    longestGap: gaps.length > 0 ? Math.max(...gaps) : 0,
    timeline,
  };
}

function computeReactionTrend(hits: ShotLogEntry[]): { index: number; value: number }[] {
  return hits
    .filter((h) => h.reactionTime > 0 && h.reactionTime < 10000)
    .map((h, i) => ({ index: i + 1, value: h.reactionTime }));
}

function computePrecisionTrend(hits: ShotLogEntry[]): PrecisionPoint[] {
  if (hits.length === 0) return [];

  const windowSize = 5;
  return hits.map((h, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(hits.length, start + windowSize);
    const window = hits.slice(start, end);
    return {
      index: i + 1,
      precision: h.precisionPts,
      avg: Math.round(avg(window.map((w) => w.precisionPts))),
    };
  });
}

function computeSuggestions(shotLog: ShotLogEntry[], hits: ShotLogEntry[]): string[] {
  const suggestions: string[] = [];

  if (hits.length === 0) {
    suggestions.push("没有命中记录，建议使用更大目标或降低灵敏度来提升命中率。");
    return suggestions;
  }

  // 水平偏移分析
  const avgX = avg(hits.map((h) => h.offsetX));
  if (Math.abs(avgX) > 0.08) {
    suggestions.push(
      avgX > 0
        ? "你的瞄准存在系统性右偏，建议检查鼠标握持姿势或适当降低灵敏度。"
        : "你的瞄准存在系统性左偏，建议检查鼠标握持姿势或适当降低灵敏度。"
    );
  }

  // 垂直偏移分析
  const avgY = avg(hits.map((h) => h.offsetY));
  if (Math.abs(avgY) > 0.08) {
    suggestions.push(
      avgY > 0
        ? "你的瞄准偏高，可能是鼠标垫空间不足或手腕角度问题。"
        : "你的瞄准偏低，建议调整鼠标DPI或手臂摆放位置。"
    );
  }

  // 反应时间疲劳分析
  const rtData = hits.filter((h) => h.reactionTime > 0 && h.reactionTime < 10000);
  if (rtData.length >= 6) {
    const mid = Math.floor(rtData.length / 2);
    const firstHalfAvg = avg(rtData.slice(0, mid).map((h) => h.reactionTime));
    const secondHalfAvg = avg(rtData.slice(mid).map((h) => h.reactionTime));
    if (secondHalfAvg > firstHalfAvg * 1.25) {
      suggestions.push("后半段反应时间明显下降，存在疲劳效应。建议缩短单次训练时长或增加休息间隔。");
    }
  }

  // 精度分析
  const highPrecisionRatio = hits.filter((h) => h.precisionPts >= 80).length / hits.length;
  if (highPrecisionRatio < 0.3) {
    suggestions.push("高精度命中比例偏低，建议放慢射击节奏，优先瞄准中心区域。");
  }

  // 连击稳定性
  const streaks: number[] = [];
  let current = 0;
  for (const shot of shotLog) {
    if (shot.hit) {
      current++;
    } else {
      if (current > 0) streaks.push(current);
      current = 0;
    }
  }
  if (current > 0) streaks.push(current);

  if (streaks.length > 0) {
    const maxStreak = Math.max(...streaks);
    const avgStreak = avg(streaks);
    if (maxStreak >= 5 && avgStreak < maxStreak * 0.4) {
      suggestions.push("连击波动较大，稳定性不足。建议使用固定节奏练习来提升连贯性。");
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("各项指标表现均衡，继续保持！可以尝试更高难度的配置来挑战自己。");
  }

  return suggestions;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
