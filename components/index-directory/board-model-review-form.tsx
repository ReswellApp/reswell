"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function BoardModelReviewForm({
  brandSlug,
  modelSlug,
  initialRating,
  initialComment,
}: {
  brandSlug: string
  modelSlug: string
  initialRating: number
  initialComment: string
}) {
  const router = useRouter()
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState(initialComment)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (rating < 1 || rating > 5) {
      setError("Choose a star rating")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/board-model-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_slug: brandSlug,
          model_slug: modelSlug,
          rating,
          comment,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong")
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5">
      <div>
        <Label className="text-sm font-medium">Your rating</Label>
        <div className="mt-2 flex flex-wrap items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= rating
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="rounded-md p-1.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                <Star
                  className={`h-8 w-8 shrink-0 sm:h-9 sm:w-9 ${!active ? "text-muted-foreground" : ""}`}
                  /* Explicit fill/stroke: strokeWidth 0 + Lucide’s default fill none hid filled stars. */
                  fill={active ? "#fbbf24" : "none"}
                  stroke={active ? "#d97706" : "currentColor"}
                  strokeWidth={active ? 1.15 : 1.35}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="board-model-review-comment" className="text-sm font-medium">
          Comments <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="board-model-review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How does it paddle, turn, or work in your usual waves?"
          className="mt-2 min-h-[120px] resize-y"
          maxLength={8000}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Saving…" : initialRating > 0 ? "Update review" : "Post review"}
      </Button>
      <p className="text-xs text-muted-foreground">
        One review per account per model; you can update it anytime.
      </p>
    </form>
  )
}
