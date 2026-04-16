import { NextResponse } from "next/server";
import { parseCSV } from "@/lib/import-csv";
import { parseXML } from "@/lib/import-xml";
import { extractCardsWithAI } from "@/lib/claude";
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

  // Step 1: Try structured parsing first
  const xml = isXML(content, file.name);
  let cards = xml ? parseXML(content) : parseCSV(content);

  // Step 2: If structured parsing found nothing, fall back to AI extraction
  if (cards.length === 0) {
    try {
      const aiCards = await extractCardsWithAI(content, file.name);
      cards = aiCards.map((c) => ({
        front: c.front,
        back: c.back,
        hint: c.hint || undefined,
      }));
    } catch {
      // AI extraction failed too — return a helpful error
      return NextResponse.json(
        { error: "Could not extract cards from this file. Please check the format and try again." },
        { status: 400 }
      );
    }
  }

  if (cards.length === 0) {
    return NextResponse.json(
      { error: "No valid cards found in file." },
      { status: 400 }
    );
  }

  return NextResponse.json({ cards, count: cards.length });
}
