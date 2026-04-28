-- One-off cleanup: delete every deck that has zero cards. These are
-- orphans left over from the failed-card-save bug — the deck got
-- created but the card POST errored on the missing imageTier column,
-- and the user retried, leaving multiple empty packs in the library.
--
-- Safe by design: only deletes decks where no Card row references the
-- deckId. Any deck with even one card is untouched. ON DELETE CASCADE
-- handles related rows correctly.
DELETE FROM "Deck"
WHERE id IN (
  SELECT d.id
  FROM "Deck" d
  LEFT JOIN "Card" c ON c."deckId" = d.id
  GROUP BY d.id
  HAVING COUNT(c.id) = 0
);
