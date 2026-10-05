import { requireAuth } from "@/lib/auth";
import { getLibraryData } from "@/lib/library-data";
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  return Response.json(await getLibraryData(auth.userId), { headers: { "Cache-Control": "private, no-store" } });
}
