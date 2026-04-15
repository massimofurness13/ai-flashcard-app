import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { importAnkiPackage } from "@/lib/anki/import";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for Anki import" },
      { status: 403 }
    );
  }

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
