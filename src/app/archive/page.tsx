import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOptionalUser, ensureUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ArchiveRow } from "@/components/archive/archive-row";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/auth/login");

  const userId = await ensureUser();

  const archivedDecks = await prisma.deck.findMany({
    where: { userId, archivedAt: { not: null } },
    include: { _count: { select: { cards: true } } },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Home
        </Link>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl mt-1">Archive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Archived packs are hidden from your home screen and study sessions.
          Stats history is preserved. Unarchive any time.
        </p>
      </div>

      {archivedDecks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-3xl">🗂️</p>
            <p className="text-sm text-muted-foreground">
              Nothing archived yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {archivedDecks.map((deck) => (
            <ArchiveRow
              key={deck.id}
              id={deck.id}
              name={deck.name}
              emoji={deck.emoji}
              cardCount={deck._count.cards}
              archivedAt={deck.archivedAt?.toISOString() ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
