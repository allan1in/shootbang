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
  const targetSize = searchParams.get("targetSize");

  const best = await prisma.personalBest.findFirst({
    where: {
      userId: session.userId,
      ...(gridSize && { gridSize: Number(gridSize) }),
      ...(targetCount && { targetCount: Number(targetCount) }),
      ...(duration && { duration: Number(duration) }),
      ...(targetSize && { targetSize }),
    },
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
    const { score, hits, totalClicks, hitRate, reactionAvg, gridSize, targetCount, duration, targetSize } = body;

    const { shotHits } = body;

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
        targetSize: targetSize ?? "default",
        ...(shotHits?.length > 0 && {
          shotHits: {
            create: shotHits.map((h: { offsetX: number; offsetY: number; reactionTime?: number; points?: number; hit?: boolean }) => ({
              offsetX: h.offsetX,
              offsetY: h.offsetY,
              reactionTime: h.reactionTime ?? null,
              points: h.points ?? null,
              hit: h.hit ?? true,
            })),
          },
        }),
      },
    });

    // Upsert PersonalBest — only updates if new score is higher
    const resolvedGridSize = record.gridSize;
    const resolvedTargetCount = record.targetCount;
    const resolvedDuration = record.duration;
    const resolvedTargetSize = record.targetSize;

    const affected = await prisma.$executeRaw`
      INSERT INTO "PersonalBest" (
        "userId","score","hits","totalClicks","hitRate","reactionAvg",
        "gridSize","targetCount","duration","targetSize","createdAt","updatedAt"
      ) VALUES (
        ${session.userId}, ${score}, ${hits}, ${totalClicks}, ${hitRate}, ${reactionAvg ?? null},
        ${resolvedGridSize}, ${resolvedTargetCount}, ${resolvedDuration}, ${resolvedTargetSize}, NOW(), NOW()
      )
      ON CONFLICT ("userId","gridSize","targetCount","duration","targetSize")
      DO UPDATE SET
        "score" = EXCLUDED."score", "hits" = EXCLUDED."hits",
        "totalClicks" = EXCLUDED."totalClicks", "hitRate" = EXCLUDED."hitRate",
        "reactionAvg" = EXCLUDED."reactionAvg", "createdAt" = EXCLUDED."createdAt",
        "updatedAt" = NOW()
      WHERE "PersonalBest"."score" < EXCLUDED."score"
    `;

    return NextResponse.json({ score: record, isNewBest: affected > 0 });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
