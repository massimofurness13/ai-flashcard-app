import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sm2, masteryLevel } from "@/lib/sm2";
import { requireAuth } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

type StudyFilter = "due" | "random" | "created" | "mastery" | "recent" | "alpha";

const VALID_FILTERS: StudyFilter[] = ["due", "random", "created", "mastery", "recent", "alpha"];

// GET /api/review — fetch cards for a study session with a chosen filter.
// Despite the route name, SM-2 runs on EVERY rating regardless of filter,
// so "study" and "review" use the same endpoint.
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const deckIds = searchParams.get("deckIds");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 500);
  const recencyCutoffDays = parseInt(searchParams.get("recencyCutoff") || "0", 10);
  const filterParam = searchParams.get("filter") || "due";
  const filter: StudyFilter = VALID_FILTERS.includes(filterParam as StudyFilter)
    ? (filterParam as StudyFilter)
    : "due";
  // Tag filter — AND-semantics: a card must have ALL listed tags to match.
  // Tag comparison is case-insensitive so "Spanish" and "spanish" merge.
  const tagFilter = (searchParams.get("tags") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const now = new Date();

  const where: Prisma.CardWhereInput = {
    deck: { userId: auth.userId },
  };

  if (deckIds) {
    where.deckId = { in: deckIds.split(",") };
  }

  // "Due" filter: only cards whose nextReviewAt has passed
  if (filter === "due") {
    where.nextReviewAt = { lte: now };
  }

  // Session-boundary exclusion — DUE only. For "due", re-serving a card
  // the user reviewed hours ago would resurface it before its SM-2
  // schedule says so, and replay a just-quit session on return — so we
  // hide anything touched in the last 6 hours.
  //
  // But the manual/practice filters — random, mastery ("needs practice"),
  // created, recent, alpha — are the user explicitly choosing WHAT to
  // see. Hiding recently-studied cards there is wrong: it made "Random"
  // come up empty right after a study session (reported bug). So we only
  // apply the exclusion for "due" (or when recencyCutoffDays is set,
  // which is an explicit "don't show me anything from the past N days").
  if (filter === "due" || recencyCutoffDays > 0) {
    const sessionCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const effectiveCutoff =
      recencyCutoffDays > 0
        ? new Date(now.getTime() - recencyCutoffDays * 86400000)
        : sessionCutoff;
    where.reviews = { none: { reviewedAt: { gte: effectiveCutoff } } };
  }

  const orderBy: Prisma.CardOrderByWithRelationInput =
    filter === "due"
      ? { nextReviewAt: "asc" }
      : filter === "created"
        ? { createdAt: "asc" }
        : filter === "recent"
          ? { createdAt: "desc" }
          : filter === "alpha"
            ? { front: "asc" }
            : { nextReviewAt: "asc" }; // fallback; random & mastery handled below

  // When a tag filter is active we over-fetch so we can JS-filter without
  // starving the session of cards. Capped to avoid pulling the whole deck.
  const fetchMultiplier =
    tagFilter.length > 0 ? 10 : filter === "random" || filter === "mastery" ? 4 : 1;
  const fetchLimit = Math.min(limit * fetchMultiplier, 2000);

  let cards = await prisma.card.findMany({
    where,
    include: {
      deck: {
        select: {
          id: true,
          name: true,
          emoji: true,
          frontVoice: true,
          backVoice: true,
          frontLanguageCode: true,
          backLanguageCode: true,
        },
      },
    },
    orderBy,
    take: fetchLimit,
  });

  if (tagFilter.length > 0) {
    cards = cards.filter((c) => {
      const cardTags = (c.tags || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      return tagFilter.every((t) => cardTags.includes(t));
    });
  }

  if (filter === "random") {
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards = cards.slice(0, limit);
  } else if (filter === "mastery") {
    // Sort by computed mastery ascending (lowest mastery = most needs practice)
    cards.sort(
      (a, b) =>
        masteryLevel({
          easeFactor: a.easeFactor,
          interval: a.interval,
          repetitions: a.repetitions,
        }) -
        masteryLevel({
          easeFactor: b.easeFactor,
          interval: b.interval,
          repetitions: b.repetitions,
        })
    );
    cards = cards.slice(0, limit);
  } else if (cards.length > limit) {
    // Catch-all trim for filters that weren't already sliced (hits when
    // we over-fetched for tag filtering).
    cards = cards.slice(0, limit);
  }

  // Randomise the study order for the "smart" filters. A brand-new user
  // whose cards are all ungraded gets them back in a stable order (which
  // for "due"/"mastery" collapses to creation order → 100 of pack A,
  // then 100 of pack B…). Shuffling the SELECTED set interleaves the
  // packs so each session feels varied. The filter still decides WHICH
  // cards are studied; only the within-session order is randomised, and
  // order doesn't matter pedagogically for a single session. "random" is
  // already shuffled above; "created"/"recent"/"alpha" keep their order
  // because there the order is the whole point.
  if (filter === "due" || filter === "mastery") {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  // Repeat-fill: the "random drill" mood ONLY. When a user picks Random
  // and asks for MORE cards than exist (e.g. "study this 100-card pack
  // 125 times"), show every unique card once, then keep going with
  // reshuffled repeats until we hit the requested count — 100 unique +
  // 25 repeats = 125.
  //
  // Gated to `random` on purpose. For every other filter — especially
  // "due" — the count is a CEILING, not a target: if only 5 cards are
  // due, the session is 5 cards, full stop. The old un-gated version
  // caused a real bug — "Due, limit 200" with 5 due cards padded to a
  // 200-card session that replayed the same 5 cards forever.
  if (filter === "random" && cards.length > 0 && cards.length < limit) {
    const unique = cards.slice();
    const filled = unique.slice();
    const shuffle = (arr: typeof unique) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    while (filled.length < limit) {
      let pass = unique.slice();
      if (filter === "random") {
        shuffle(pass);
        // Avoid the last-of-previous-pass === first-of-this-pass seam.
        if (pass.length > 1 && filled[filled.length - 1]?.id === pass[0].id) {
          [pass[0], pass[1]] = [pass[1], pass[0]];
        }
      }
      const room = limit - filled.length;
      pass = pass.slice(0, room);
      filled.push(...pass);
    }
    cards = filled;
  }

  const totalAvailable = await prisma.card.count({ where });

  // The user's onboarding learning language drives the voice
  // fallback for any deck that has no explicit front/back language
  // code (e.g. an AI-generated pack where the language picker was
  // skipped). The study session maps this to a BCP-47 code so we
  // never drop to the robotic device voice.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { learningLanguage: true },
  });

  return NextResponse.json({
    cards,
    totalDue: totalAvailable,
    total: totalAvailable,
    learningLanguage: user?.learningLanguage ?? null,
  });
}

// POST /api/review — submit a review rating (SM-2 update)
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { cardId, quality } = body;

  if (!cardId || quality === undefined) {
    return NextResponse.json(
      { error: "cardId and quality are required" },
      { status: 400 }
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { userId: true } } },
  });

  if (!card || card.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Passive view (quality === 0): the user saw the card in
  // auto-advance mode but didn't actively rate it. Log the view so
  // daily count, streak, and "pack studied" status all reflect it,
  // but DON'T touch SM-2 fields — guessing "Good" on a card the
  // user might not actually know would corrupt the schedule. The
  // log row preserves the current ease/interval as a snapshot for
  // history, even though they didn't change.
  if (quality === 0) {
    await prisma.reviewLog.create({
      data: {
        cardId,
        quality: 0,
        easeFactor: card.easeFactor,
        interval: card.interval,
      },
    });
    return NextResponse.json({ recorded: true, passive: true });
  }

  const result = sm2(quality, {
    easeFactor: card.easeFactor,
    interval: card.interval,
    repetitions: card.repetitions,
  });

  const [updatedCard] = await Promise.all([
    prisma.card.update({
      where: { id: cardId },
      data: {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
      },
    }),
    prisma.reviewLog.create({
      data: {
        cardId,
        quality,
        easeFactor: result.easeFactor,
        interval: result.interval,
      },
    }),
  ]);

  return NextResponse.json({
    card: updatedCard,
    nextReviewAt: result.nextReviewAt,
    interval: result.interval,
  });
}
