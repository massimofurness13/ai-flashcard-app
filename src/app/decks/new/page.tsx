import { ensureUser } from "@/lib/auth";
import { DeckForm } from "@/components/deck/deck-form";

export default async function NewDeckPage() {
  await ensureUser();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create New Pack</h1>
      <DeckForm mode="create" />
    </div>
  );
}
