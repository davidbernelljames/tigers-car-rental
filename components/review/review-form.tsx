"use client";

import * as React from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_COMMENT = 500;

export function ReviewForm({
  bookingRef,
  customerName,
}: {
  bookingRef: string;
  customerName: string;
}) {
  const [rating, setRating] = React.useState(0);
  const [hovered, setHovered] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingRef, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your review.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-status-available mx-auto mb-3" />
          <p className="font-semibold text-neutral-900">
            Thank you, {customerName}
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Your feedback has been recorded. We appreciate it.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stars are real buttons rather than styled spans so the control is
  // keyboard-reachable and screen-reader-labelled, not mouse-only.
  const displayed = hovered || rating;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label required>Your rating</Label>
            <div
              className="flex gap-1 mt-1"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => {
                    setRating(value);
                    setError(null);
                  }}
                  onMouseEnter={() => setHovered(value)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      value <= displayed
                        ? "fill-customer-accent text-customer-accent"
                        : "text-neutral-300"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="comment">Anything you&apos;d like to add?</Label>
            <Textarea
              id="comment"
              rows={4}
              maxLength={MAX_COMMENT}
              placeholder="Optional — tell us how the rental went."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="text-xs text-neutral-400 mt-1">
              {comment.length}/{MAX_COMMENT}
            </p>
          </div>

          {error && <p className="text-sm text-status-maintenance">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
