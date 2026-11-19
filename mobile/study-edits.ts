import type { OfflineMutation } from "@/lib/offline-mutation-schema";
import type { StudyResumeCard, StudyResumeSnapshot } from "@/lib/study-resume";
import type { SavedStudy } from "@/lib/offline-study";

/** Patch every durable session, preserving its cursor and actual review tally. */
export function patchSavedStudy(input: SavedStudy | StudyResumeSnapshot, operation: OfflineMutation["operation"]) {
  if (!Array.isArray(input.cards)) return input;
  const remove = (card: StudyResumeCard) =>
    (operation.kind === "card:delete" && card.id === operation.id) ||
    (operation.kind === "deck:delete" && card.deck.id === operation.id) ||
    (operation.kind === "deck:update" && operation.fields.archive === true && card.deck.id === operation.id);
  const removedIds = new Set(input.cards.filter(remove).map(c => c.id));
  const shift = (index: number) => input.cards.slice(0, index).filter(remove).length;
  const cards = input.cards.filter(c => !remove(c)).map(card => {
    if (operation.kind === "card:update" && card.id === operation.id) return {...card, ...operation.fields};
    if (operation.kind === "deck:update" && card.deck.id === operation.id) return {...card, deck: {...card.deck, ...operation.fields}};
    return card;
  });
  if ("currentIndex" in input) return {...input, cards,
    currentIndex: Math.min(cards.length, input.currentIndex - shift(input.currentIndex)),
    undoHistory: input.undoHistory?.filter(h => !removedIds.has(h.review.cardId)).map(h => ({...h, index: h.index - shift(h.index)}))};
  if (!input.daily) return {...input, cards};
  const picks = input.daily.picks?.filter(p => !removedIds.has(p.id));
  return {...input, cards, daily: {...input.daily, ...(picks ? {picks} : {}),
    total: Math.max(0, input.daily.total - removedIds.size),
    ...(picks ? {mix: {practice: picks.filter(p=>p.group==="practice").length, retention: picks.filter(p=>p.group==="retention").length, new: picks.filter(p=>p.group==="new").length}} : {})}};
}
