import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gridSize = Number(searchParams.get("gridSize"));
  const targetCount = Number(searchParams.get("targetCount"));
  const duration = Number(searchParams.get("duration"));
  const targetSize = searchParams.get("targetSize") || "default";

  if (!gridSize || !targetCount || !duration) {
    return NextResponse.json(
      { error: "缺少 gridSize, targetCount, duration 参数" },
      { status: 400 },
    );
  }

  const entries = await prisma.personalBest.findMany({
    where: { gridSize, targetCount, duration, targetSize },
    orderBy: { score: "desc" },
    take: 10,
    include: { user: { select: { email: true } } },
  });

  return NextResponse.json({ entries });
}
