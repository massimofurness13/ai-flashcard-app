import { NextResponse } from "next/server";
import { parseCSV } from "@/lib/import-csv";
import { parseXML } from "@/lib/import-xml";
import { requireAuth } from "@/lib/auth";

function isXML(content: string, fileName: string): boolean {
  if (fileName.toLowerCase().endsWith(".xml")) return true;
  const trimmed = content.trimStart();
  return trimmed.startsWith("<?xml") || trimmed.startsWith("<");
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const content = await file.text();
  const xml = isXML(content, file.name);
  const cards = xml ? parseXML(content) : parseCSV(content);

  if (cards.length === 0) {
    const hint = xml
      ? "No valid cards found in XML. Ensure each card has front and back elements."
      : "No valid cards found in file. Ensure at least 2 columns (front, back).";
    return NextResponse.json({ error: hint }, { status: 400 });
  }

  return NextResponse.json({ cards, count: cards.length });
}
