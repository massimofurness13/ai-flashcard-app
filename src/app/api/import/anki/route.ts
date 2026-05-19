import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { importAnkiPackage } from "@/lib/anki/import";

// Anki import is FREE for all authenticated users — "your data, your
// app". The only thing we charge for is AI image generation, which
// happens on a separate per-card flow gated by the credit-quota system.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".apkg") && !file.name.endsWith(".colpkg")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an .apkg file" },
        { status: 400 }
      );
    }

    // Limit file size to 100MB
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importAnkiPackage(auth.userId, buffer);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
