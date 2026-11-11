import type { Prisma } from "@/generated/prisma/client";

/** A card is due if either direction is untested or its recall timer has elapsed. */
export function directionalDueWhere(now: Date): Prisma.CardWhereInput {
  return { OR: [
    { recallStates: { none: { direction: "front" } } },
    { recallStates: { none: { direction: "back" } } },
    { recallStates: { some: { nextReviewAt: { lte: now } } } },
  ] };
}
