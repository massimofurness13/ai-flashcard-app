import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listGoogleVoices } from "@/lib/tts-server";

/**
 * GET /api/tts/voices?lang=es-MX
 *
 * Debug endpoint: lists all Google Cloud TTS voices the configured
 * service account has access to, filtered to a single locale if `lang`
 * is provided. Also reports which Render commit is currently serving
 * (RENDER_GIT_COMMIT env var, set automatically by Render).
 *
 * Used to get ground truth for which voice IDs are valid instead of
 * guessing — name a wrong voice and synthesize returns 400.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const lang = request.nextUrl.searchParams.get("lang") ?? undefined;

  const deployed = {
    commit: process.env.RENDER_GIT_COMMIT ?? "unknown",
    branch: process.env.RENDER_GIT_BRANCH ?? "unknown",
    googleConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
  };

  try {
    const voices = await listGoogleVoices(lang);
    return NextResponse.json({ deployed, count: voices.length, voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { deployed, error: "listVoices failed", detail: message },
      { status: 502 }
    );
  }
}
