import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const folders = await prisma.folder.findMany({
    where: { userId: auth.userId },
    include: {
      decks: {
        include: {
          _count: { select: { cards: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(folders);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { name, emoji, color } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      emoji: emoji || undefined,
      color: color || undefined,
      userId: auth.userId,
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
