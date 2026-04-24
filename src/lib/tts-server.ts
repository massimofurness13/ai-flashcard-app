import crypto from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import textToSpeech from "@google-cloud/text-to-speech";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { resolveVoice, type VoiceEntry, type ResolvedVoice } from "./voice-catalog";

const BUCKET = "card-images";
const AUDIO_PREFIX = "audio";

/**
 * Cache architecture: hash (normalised text + provider + voice) → one blob,
 * shared across every user in the product. Once any user has triggered
 * generation for "Hola" with Google Spanish voice, every subsequent user
 * anywhere plays it for free from CDN.
 *
 * Why these specific inputs to the hash:
 *   - text: obviously
 *   - provider + voice: different voices produce different audio, must be
 *     in the key
 * Language code is implicit in the voice (Google voice "es-MX-Neural2-A"
 * encodes es-MX), so not included separately.
 */
function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function cacheKey(text: string, voice: ResolvedVoice): string {
  const voiceTag =
    voice.provider === "elevenlabs"
      ? `11l:${voice.voiceId}:${voice.model}`
      : `gcp:${voice.voiceName}`;
  const input = `${normaliseText(text)}|${voiceTag}`;
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createServiceClient(url, key);
}

async function blobExists(path: string): Promise<boolean> {
  const sb = supabase();
  // `list` with a prefix matching just this file is the cheapest check —
  // avoids pulling down the blob just to test for presence.
  const dir = path.substring(0, path.lastIndexOf("/"));
  const file = path.substring(path.lastIndexOf("/") + 1);
  const { data, error } = await sb.storage.from(BUCKET).list(dir, {
    search: file,
    limit: 1,
  });
  if (error) return false;
  return (data ?? []).some((item) => item.name === file);
}

function publicUrl(path: string): string {
  return supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadAudio(path: string, mp3: Buffer): Promise<string> {
  const sb = supabase();
  const { error } = await sb.storage.from(BUCKET).upload(path, mp3, {
    contentType: "audio/mpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  // Race-condition safe: another request may have uploaded concurrently,
  // in which case we just return the URL of the existing blob.
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
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
  });
  if (!response.audioContent) throw new Error("Google TTS returned no audio");
  return Buffer.from(response.audioContent as Uint8Array);
}

// ── ElevenLabs ──────────────────────────────────────────────────────────

let elevenClient: ElevenLabsClient | null = null;

function getElevenClient() {
  if (elevenClient) return elevenClient;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  elevenClient = new ElevenLabsClient({ apiKey });
  return elevenClient;
}

async function generateEleven(
  text: string,
  voiceId: string,
  model: string
): Promise<Buffer> {
  const client = getElevenClient();
  // The SDK returns a web ReadableStream of audio chunks. We concatenate
  // to a single Buffer for the Supabase upload.
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: model,
    outputFormat: "mp3_44100_128",
  });
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return Buffer.from(out);
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get or create the audio URL for `text` in the voice resolved from
 * `entry` + `isPro`. Returns a Supabase Storage public URL. Lazy:
 * generates on first call for a given (text, voice) pair, cached forever.
 */
export async function getOrCreateAudioUrl(
  text: string,
  entry: VoiceEntry,
  isPro: boolean
): Promise<string> {
  const voice = resolveVoice(entry, isPro);
  const hash = cacheKey(text, voice);
  const path = `${AUDIO_PREFIX}/${hash}.mp3`;

  if (await blobExists(path)) return publicUrl(path);

  const mp3 =
    voice.provider === "elevenlabs"
      ? await generateEleven(text, voice.voiceId, voice.model)
      : await generateGoogle(text, voice.voiceName, voice.languageCode);

  return uploadAudio(path, mp3);
}
