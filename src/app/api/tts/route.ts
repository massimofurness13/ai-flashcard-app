import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { getVoiceEntry } from "@/lib/voice-catalog";
import { getOrCreateAudioUrl } from "@/lib/tts-server";

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
  languageCode: z.string().min(2).max(16),
});

/**
 * POST /api/tts
 *   body: { text: string, languageCode: "es-MX" | ... }
 *   returns: { audioUrl: string } — public CDN URL of the MP3.
 *
 * Pro users get ElevenLabs Multilingual v2 when a curated voice exists
 * for the language; everyone else gets Google Cloud Neural2. Audio is
 * cached in Supabase Storage keyed by sha256(text+provider+voice), so
 * a given (text, voice) pair is generated once ever, shared across all
 * users of the product forever.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = getVoiceEntry(parsed.data.languageCode);
  if (!entry) {
    return NextResponse.json(
      { error: `Unsupported language: ${parsed.data.languageCode}` },
      { status: 400 }
    );
  }

  const isPro = await isProUser(auth.userId);

  try {
    const audioUrl = await getOrCreateAudioUrl(parsed.data.text, entry, isPro);
    return NextResponse.json({ audioUrl });
  } catch (err) {
    // Surface the real error in the response body so debugging doesn't
    // require SSH-ing into Render logs every time. The client falls back
    // to Web Speech on any non-200, so exposing this doesn't break UX.
    const message = err instanceof Error ? err.message : String(err);
    console.error("TTS generation failed", err);
    return NextResponse.json(
      {
        error: "TTS generation failed",
        detail: message,
        provider: isPro ? "elevenlabs-or-google" : "google",
      },
      { status: 502 }
    );
  }
}
