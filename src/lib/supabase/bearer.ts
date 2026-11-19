/** Only pass well-formed bearer credentials to Supabase for verification. */
export function bearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(value);
  return match && match[1].length <= 16384 ? match[1] : null;
}
