import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const scores = await prisma.score.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const { searchParams } = new URL(request.url);
  const gridSize = searchParams.get("gridSize");
  const targetCount = searchParams.get("targetCount");
  const duration = searchParams.get("duration");

  const best = await prisma.score.findFirst({
    where: {
      userId: session.userId,
      ...(gridSize && { gridSize: Number(gridSize) }),
      ...(targetCount && { targetCount: Number(targetCount) }),
      ...(duration && { duration: Number(duration) }),
    },
    orderBy: { score: "desc" },
  });

  return NextResponse.json({ scores, best });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { score, hits, totalClicks, hitRate, reactionAvg, gridSize, targetCount, duration } = body;

    const record = await prisma.score.create({
      data: {
        userId: session.userId,
        score,
        hits,
        totalClicks,
        hitRate,
        reactionAvg: reactionAvg ?? null,
        gridSize: gridSize ?? 3,
        targetCount: targetCount ?? 3,
        duration: duration ?? 30,
      },
    });

    // Check if new personal best (per settings combination)
    const best = await prisma.score.findFirst({
      where: {
        userId: session.userId,
        gridSize: record.gridSize,
        targetCount: record.targetCount,
        duration: record.duration,
      },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ score: record, isNewBest: best?.id === record.id });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
