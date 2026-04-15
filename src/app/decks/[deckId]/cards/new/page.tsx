import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { FlashcardForm } from "@/components/flashcard/flashcard-form";

export default async function NewCardPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const userId = await ensureUser();
  const { deckId } = await params;
  const isPro = await isProUser(userId);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Card</h1>
      <FlashcardForm deckId={deckId} mode="create" isPro={isPro} />
    </div>
  );
}
