import * as THREE from "three";

export interface TargetState {
  mesh: THREE.Mesh;
  gridIndex: number;
  spawnTime: number;
}

/**
 * 根据网格大小计算目标间距（不超过墙壁边界）
 */
export function getGridSpacing(n: number): number {
  const wallW = 50;
  const wallH = 14;
  const margin = 2;
  return Math.min(
    1.5,
    (wallW - margin * 2) / (n - 1 || 1),
    (wallH - margin * 2) / (n - 1 || 1),
  );
}

/**
 * 生成 N×N 网格中每个格子的世界坐标 [x, y]
 */
export function generateGridPositions(n: number): [number, number][] {
  const spacing = getGridSpacing(n);
  const span = spacing * (n - 1);
  const startX = -span / 2;
  const startY = 6.5 + span / 2;
  const pos: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      pos.push([startX + c * spacing, startY - r * spacing]);
    }
  }
  return pos;
}

/**
 * 隐藏所有目标
 */
export function hideAllTargets(targets: TargetState[]) {
  for (const t of targets) t.mesh.visible = false;
}

/**
 * 在随机空位生成一个目标
 */
export function spawnTarget(
  target: TargetState,
  allTargets: TargetState[],
  gridPositions: [number, number][],
  targetCount: number,
) {
  const active = allTargets.slice(0, targetCount);
  const occupied = new Set(
    active.filter((t) => t.mesh.visible).map((t) => t.gridIndex),
  );
  occupied.add(target.gridIndex);
  const available = gridPositions
    .map((_, i) => i)
    .filter((i) => !occupied.has(i));
  if (available.length === 0) return;
  const idx = available[Math.floor(Math.random() * available.length)];
  const [x, y] = gridPositions[idx];
  target.gridIndex = idx;
  target.mesh.position.set(x, y, -5);
  target.mesh.visible = true;
  target.spawnTime = Date.now();
}
