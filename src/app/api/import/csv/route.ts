import { NextResponse } from "next/server";
import { parseCSV } from "@/lib/import-csv";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const content = await file.text();
  const cards = parseCSV(content);

  if (cards.length === 0) {
    return NextResponse.json(
      { error: "No valid cards found in file. Ensure at least 2 columns (front, back)." },
      { status: 400 }
    );
  }

  return NextResponse.json({ cards, count: cards.length });
}
