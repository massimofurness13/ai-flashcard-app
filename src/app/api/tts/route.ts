import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getVoiceEntry } from "@/lib/voice-catalog";
import { getOrCreateAudioUrl } from "@/lib/tts-server";
import { rateLimit } from "@/lib/validations";

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
  languageCode: z.string().min(2).max(16),
});

// 120 TTS requests / min / user. A study session typically rings the
// TTS endpoint ~2x per card (front + back), and 1 card every few
// seconds is the upper bound of human flipping. 120/min comfortably
// covers that with headroom for preloader prefetches; anything
// significantly above is a script. Cap protects us from worst-case
// Google TTS spend ($16/M chars uncached) — without it, a single
// authenticated user can burn unbounded $$$ on cache-miss prompts.
const TTS_MAX_PER_MINUTE = 120;

/**
 * POST /api/tts
 *   body: { text: string, languageCode: "es-MX" | ... }
 *   returns: { audioUrl: string } — public CDN URL of the MP3.
 *
 * Serves Google Cloud TTS (Chirp 3 HD with Neural2 / Wavenet fallback)
 * from a Supabase Storage cache keyed by sha256(text + voice). A given
 * (text, voice) pair is generated exactly once ever, shared across all
 * users of the product forever.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Rate limit BEFORE the JSON parse — even rejected requests are
  // cheap, so a flood with malformed bodies shouldn't slow us down.
  if (!rateLimit(`tts:${auth.userId}`, TTS_MAX_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { error: "Too many TTS requests. Please slow down." },
      { status: 429 },
    );
  }

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

  try {
    const audioUrl = await getOrCreateAudioUrl(parsed.data.text, entry);
    return NextResponse.json({ audioUrl });
  } catch (err) {
    // Surface the real error in the response body so debugging doesn't
    // require SSH-ing into Render logs every time. The client falls back
    // to Web Speech on any non-200, so exposing this doesn't break UX.
    const message = err instanceof Error ? err.message : String(err);
    console.error("TTS generation failed", err);
    return NextResponse.json(
      { error: "TTS generation failed", detail: message },
      { status: 502 }
    );
  }
}
