/** Do not remove a pack from the UI until the server confirms the change. */
export async function setPackArchived(id: string, archive: boolean): Promise<void> {
  const response = await fetch(`/api/decks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.id !== id || (archive ? !data.archivedAt : data.archivedAt !== null)) {
    throw new Error(archive
      ? "Couldn't archive this pack. Please try again."
      : "Couldn't restore this pack. Please try again.");
  }
}
