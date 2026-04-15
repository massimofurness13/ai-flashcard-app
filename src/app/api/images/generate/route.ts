import { NextResponse } from "next/server";
import { imageGenerator } from "@/lib/image-generator";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const result = await imageGenerator.generate(prompt);

  return NextResponse.json(result);
}
