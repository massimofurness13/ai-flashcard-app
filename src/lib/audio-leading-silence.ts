/** Conservative playback-only trim. Original recordings stay intact on disk.
 * Require sustained energy (not one MP3 click), keep 120ms before it, never
 * trim a uniformly quiet recording or search beyond the first 1.5 seconds.
 * This is an energy heuristic, not a word-boundary/speech recogniser.
 */
export function leadingSilenceOffset(buffer: Pick<AudioBuffer, "sampleRate" | "length" | "numberOfChannels" | "getChannelData">): number {
  const step = Math.max(1, Math.round(buffer.sampleRate * .01));
  const limit = Math.min(buffer.length, Math.round(buffer.sampleRate * 1.5));
  const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
  let sustained = 0;
  for (let start = 0; start + step <= limit; start += step) {
    let energy = 0;
    for (const samples of channels) {
      let sum = 0;
      for (let i = start; i < start + step; i++) sum += samples[i] * samples[i];
      energy = Math.max(energy, Math.sqrt(sum / step));
    }
    sustained = energy >= .004 ? sustained + 1 : 0;
    if (sustained >= 2) {
      const offset = Math.max(0, (start - step) / buffer.sampleRate - .12);
      return offset >= .08 ? offset : 0;
    }
  }
  return 0;
}
