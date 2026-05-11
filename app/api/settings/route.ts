import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let settings = await prisma.settings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: { userId: session.userId },
    });
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sensitivity, duration, gridSize, targetCount, crosshairSize, crosshairStyle, targetSize } = body;

    const settings = await prisma.settings.upsert({
      where: { userId: session.userId },
      update: {
        ...(sensitivity !== undefined && { sensitivity }),
        ...(duration !== undefined && { duration }),
        ...(gridSize !== undefined && { gridSize }),
        ...(targetCount !== undefined && { targetCount }),
        ...(crosshairSize !== undefined && { crosshairSize }),
        ...(crosshairStyle !== undefined && { crosshairStyle }),
        ...(targetSize !== undefined && { targetSize }),
      },
      create: {
        userId: session.userId,
        sensitivity: sensitivity ?? 1.0,
        duration: duration ?? 30,
        gridSize: gridSize ?? 3,
        targetCount: targetCount ?? 3,
        crosshairSize: crosshairSize ?? 24,
        crosshairStyle: crosshairStyle ?? "cross",
        targetSize: targetSize ?? "default",
      },
    });

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
