import crypto from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import textToSpeech from "@google-cloud/text-to-speech";
import { resolveVoice, type VoiceEntry, type ResolvedVoice } from "./voice-catalog";

// Audio uses a dedicated bucket because the card-images bucket has MIME
// type restrictions (image/*) that reject audio/mpeg uploads. The audio
// bucket is public + allows mp3/ogg/wav — auto-created on first use.
const AUDIO_BUCKET = "card-audio";
const AUDIO_ALLOWED_MIME = ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav"];
const AUDIO_PREFIX = "audio";

// Tracks whether we've verified the bucket exists this process lifetime,
// so we only make the check-or-create round trip once per cold start.
let bucketReady = false;

/**
 * Cache architecture: hash (normalised text + provider + voice) → one blob,
 * shared across every user in the product. Once any user has triggered
 * generation for "Hola" with a given voice, every subsequent user anywhere
 * plays it for free from CDN.
 *
 * Hash inputs:
 *   - text (normalised)
 *   - provider + voice name (different voices produce different audio)
 * Language code is implicit in the voice (e.g. "es-MX-Chirp3-HD-Aoede"
 * already encodes the locale), so not included separately.
 */
function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function cacheKey(text: string, voice: ResolvedVoice): string {
  const voiceTag = `gcp:${voice.voiceName}`;
  const input = `${normaliseText(text)}|${voiceTag}`;
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createServiceClient(url, key);
}

/**
 * Create the audio bucket lazily on first upload if it doesn't exist.
 * Using a service role client so we can bypass RLS and bucket-creation
 * permissions. Idempotent: a second call just confirms it's there.
 */
async function ensureAudioBucket(): Promise<void> {
  if (bucketReady) return;
  const sb = supabase();

  const { data: existing } = await sb.storage.getBucket(AUDIO_BUCKET);
  if (existing) {
    bucketReady = true;
    return;
  }

  const { error } = await sb.storage.createBucket(AUDIO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB per clip is plenty for any card
    allowedMimeTypes: AUDIO_ALLOWED_MIME,
  });
  // If two concurrent requests race to create, the loser gets a
  // "duplicate"/"already exists" error, which is fine.
  if (error && !/already exists|duplicate|resource.*already/i.test(error.message)) {
    throw new Error(`Failed to create audio bucket: ${error.message}`);
  }
  bucketReady = true;
}

async function blobExists(path: string): Promise<boolean> {
  const sb = supabase();
  const dir = path.substring(0, path.lastIndexOf("/"));
  const file = path.substring(path.lastIndexOf("/") + 1);
  const { data, error } = await sb.storage.from(AUDIO_BUCKET).list(dir, {
    search: file,
    limit: 1,
  });
  if (error) return false;
  return (data ?? []).some((item) => item.name === file);
}

function publicUrl(path: string): string {
  return supabase().storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadAudio(path: string, mp3: Buffer): Promise<string> {
  await ensureAudioBucket();
  const sb = supabase();
  const { error } = await sb.storage.from(AUDIO_BUCKET).upload(path, mp3, {
    contentType: "audio/mpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`TTS upload failed: ${error.message}`);
  }
  return publicUrl(path);
}

// ── Google Cloud TTS ────────────────────────────────────────────────────

let googleClient: InstanceType<typeof textToSpeech.TextToSpeechClient> | null = null;

function getGoogleClient() {
  if (googleClient) return googleClient;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const credentials = JSON.parse(json);
  googleClient = new textToSpeech.TextToSpeechClient({ credentials });
  return googleClient;
}

async function generateGoogle(
  text: string,
  voiceName: string,
  languageCode: string
): Promise<Buffer> {
  const client = getGoogleClient();
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
    });
    if (!response.audioContent) throw new Error("Google TTS returned no audio");
    return Buffer.from(response.audioContent as Uint8Array);
  } catch (err) {
    // If our catalog references a voice this service account doesn't have
    // access to (Google retires voices occasionally; Chirp 3 HD isn't
    // offered for every locale), retry without a specific voice. Google
    // picks any available voice for the language. Keeps a single stale
    // catalog entry from bricking an entire language.
    const msg = err instanceof Error ? err.message : String(err);
    const isVoiceMissing = /does not exist|not found|INVALID_ARGUMENT/i.test(msg);
    if (!isVoiceMissing) throw err;

    console.warn(
      `Google TTS voice "${voiceName}" unavailable; falling back to default voice for ${languageCode}`
    );
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
    });
    if (!response.audioContent) throw new Error("Google TTS returned no audio");
    return Buffer.from(response.audioContent as Uint8Array);
  }
}

/**
 * Returns all voice names Google will accept for this service account,
 * filtered by language. Used by /api/tts/voices to give us ground truth
 * for which voice IDs are valid without guessing.
 */
export async function listGoogleVoices(
  languageFilter?: string
): Promise<Array<{ name: string; languageCode: string; gender: string }>> {
  const client = getGoogleClient();
  const [response] = await client.listVoices({
    languageCode: languageFilter,
  });
  return (response.voices ?? []).map((v) => ({
    name: v.name ?? "",
    languageCode: (v.languageCodes ?? [])[0] ?? "",
    gender: String(v.ssmlGender ?? "NEUTRAL"),
  }));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get or create the audio URL for `text` in the voice resolved for
 * `entry`. Returns a Supabase Storage public URL. Lazy: generates on
 * first call for a given (text, voice) pair, cached forever.
 */
export async function getOrCreateAudioUrl(
  text: string,
  entry: VoiceEntry
): Promise<string> {
  const voice = resolveVoice(entry);
  const hash = cacheKey(text, voice);
  const path = `${AUDIO_PREFIX}/${hash}.mp3`;

  if (await blobExists(path)) return publicUrl(path);

  const mp3 = await generateGoogle(
    text,
    voice.voiceName,
    voice.languageCode
  );

  return uploadAudio(path, mp3);
}
