"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Small thumbs-down button that opens a feedback dialog for an AI-
 * generated card image. Submitting non-empty feedback grants ONE
 * free regeneration of the image at the same tier — paid in writing,
 * not credits.
 *
 * Why: we want a steady stream of "this image didn't work, here's
 * why" notes from real users so we can scan patterns and tune the
 * generator prompt. Asking for feedback in exchange for a free
 * regen aligns incentives — the user gets a better picture, we get
 * the data we need to make every future picture better.
 *
 * Constraints:
 *  - Only renders when there's a saved card to feedback ON
 *    (mode "create" before save has no cardId).
 *  - Server enforces one-free-regen-per-card via
 *    Card.freeImageRegenUsed; further feedback is still saved
 *    but won't trigger another free regen.
 */
interface ImageFeedbackButtonProps {
  cardId: string;
  onImageRegenerated: (url: string, tier: "quick" | "premium") => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "regenerated" }
  | { kind: "logged-no-regen"; message: string }
  | { kind: "error"; message: string };

export function ImageFeedbackButton({
  cardId,
  onImageRegenerated,
}: ImageFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function close() {
    setOpen(false);
    setText("");
    setStatus({ kind: "idle" });
  }

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setStatus({
        kind: "error",
        message: "A few words please — even 'too dark' or 'wrong setting' helps.",
      });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/images/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, feedback: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error || "Something went wrong. Try again.",
        });
        return;
      }
      if (data.regenerated && data.imageUrl && data.tier) {
        onImageRegenerated(data.imageUrl, data.tier);
        setStatus({ kind: "regenerated" });
      } else {
        setStatus({
          kind: "logged-no-regen",
          message: data.message || "Thanks — feedback logged.",
        });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Try again in a moment.",
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute -top-2 -left-2 bg-card border border-border text-muted-foreground rounded-full w-6 h-6 flex items-center justify-center hover:border-primary hover:text-foreground transition-colors"
        aria-label="Image not great — give feedback for a free regen"
        title="Image not great? Give feedback to get a free regen"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.5a.5.5 0 00.5-.5V14m-3 0h3m4-10v10m0-10h2.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 14H14"
            transform="scale(1, -1) translate(0, -22)"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {(status.kind === "idle" ||
              status.kind === "submitting" ||
              status.kind === "error") && (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">
                    What&apos;s off about this image?
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Tell us in a few words. We&apos;ll regenerate the image
                    once on us — and use what you say to make every future
                    image more memorable.
                  </p>
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. wrong sport, weird hands, too generic, doesn't match the card meaning…"
                  rows={4}
                  maxLength={500}
                  disabled={status.kind === "submitting"}
                />
                {status.kind === "error" && (
                  <p className="text-sm text-destructive">{status.message}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={close}
                    disabled={status.kind === "submitting"}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={submit}
                    disabled={status.kind === "submitting"}
                  >
                    {status.kind === "submitting"
                      ? "Submitting…"
                      : "Submit & regenerate"}
                  </Button>
                </div>
              </>
            )}

            {status.kind === "regenerated" && (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <p className="font-medium">
                  Thanks — here&apos;s a fresh take.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your feedback is saved. If this one is closer to what you
                  had in mind, you&apos;re good to go.
                </p>
                <Button onClick={close}>Close</Button>
              </div>
            )}

            {status.kind === "logged-no-regen" && (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="font-medium">Feedback saved — thank you.</p>
                <p className="text-sm text-muted-foreground">
                  {status.message}
                </p>
                <Button onClick={close}>Close</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
