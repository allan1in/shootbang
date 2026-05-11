import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const gridSize = searchParams.get("gridSize");
    const targetCount = searchParams.get("targetCount");
    const duration = searchParams.get("duration");
    const targetSize = searchParams.get("targetSize");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = 50;

    const where = {
      userId: session.userId,
      ...(gridSize && { gridSize: Number(gridSize) }),
      ...(targetCount && { targetCount: Number(targetCount) }),
      ...(duration && { duration: Number(duration) }),
      ...(targetSize && { targetSize }),
    };

    const [scores, total, filterGroups] = await Promise.all([
      prisma.score.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.score.count({ where }),
      prisma.score.groupBy({
        by: ["gridSize", "targetCount", "duration", "targetSize"],
        where: { userId: session.userId },
      }),
    ]);

    return NextResponse.json({
      scores,
      total,
      filters: filterGroups.map((g) => ({
        gridSize: g.gridSize,
        targetCount: g.targetCount,
        duration: g.duration,
        targetSize: g.targetSize,
      })),
    });
  } catch (e) {
    console.error("History API error:", e);
    return NextResponse.json({ error: "加载失败", detail: String(e) }, { status: 500 });
  }
}
