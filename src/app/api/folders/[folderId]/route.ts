import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { folderId } = await params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.folder.findUnique({
    where: { id: folderId, userId: auth.userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const folder = await prisma.folder.update({
    where: { id: folderId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.color !== undefined && { color: body.color }),
    },
  });

  return NextResponse.json(folder);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { folderId } = await params;

  // Verify ownership
  const existing = await prisma.folder.findUnique({
    where: { id: folderId, userId: auth.userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  await prisma.folder.delete({ where: { id: folderId } });

  return NextResponse.json({ success: true });
}
