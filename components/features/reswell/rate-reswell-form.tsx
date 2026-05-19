"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarDays, Info, Lightbulb, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import reswellLogoPng from "@/public/images/reswell-logo.png"
import { ReswellPlatformStarBox } from "@/components/features/reswell/reswell-platform-star-boxes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitReswellPlatformReviewAction } from "@/lib/actions/reswellPlatformReview"
import { RESWELL_REVIEW_MENTION_TAGS } from "@/lib/reswell-platform-review-stats"
import { cn } from "@/lib/utils"

const RESEWELL_LOGO_SRC =
  typeof reswellLogoPng !== "string" ? reswellLogoPng.src : reswellLogoPng

export type RateReswellFormProps = {
  initialFullName?: string
  initialTitle?: string
  initialDescription?: string
  initialExperienceDate?: string
  initialRating?: number
  hasExistingReview?: boolean
}

function splitStoredReviewContent(description: string): { title: string; body: string } {
  const trimmed = description.trim()
  if (!trimmed) {
    return { title: "", body: "" }
  }

  const parts = trimmed.split(/\n\n/)
  if (parts.length >= 2 && parts[0].length <= 120) {
    return { title: parts[0], body: parts.slice(1).join("\n\n") }
  }

  return { title: "", body: trimmed }
}

export function RateReswellForm({
  initialFullName = "",
  initialTitle = "",
  initialDescription = "",
  initialExperienceDate = "",
  initialRating = 5,
  hasExistingReview = false,
}: RateReswellFormProps) {
  const parsedInitial = splitStoredReviewContent(initialDescription)
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName)
  const [title, setTitle] = useState(initialTitle || parsedInitial.title)
  const [description, setDescription] = useState(parsedInitial.body)
  const [experienceDate, setExperienceDate] = useState(initialExperienceDate)
  const [rating, setRating] = useState(initialRating)
  const [confirmed, setConfirmed] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [loading, setLoading] = useState(false)

  const appendMention = (tag: string) => {
    const snippet = tag.toLowerCase()
    setDescription((current) => {
      const trimmed = current.trim()
      if (!trimmed) {
        return `My experience with ${snippet} on Reswell was great.`
      }
      if (trimmed.toLowerCase().includes(snippet)) {
        return current
      }
      return `${trimmed} ${tag} was part of my experience.`
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!confirmed) {
      toast.error("Confirm your review is based on a genuine experience.")
      return
    }

    setLoading(true)
    try {
      let finalDescription = description.trim()
      if (experienceDate.trim()) {
        const formattedDate = format(new Date(`${experienceDate}T12:00:00`), "MMMM d, yyyy")
        finalDescription = `${finalDescription}\n\nExperience date: ${formattedDate}`
      }

      const result = await submitReswellPlatformReviewAction({
        fullName,
        title: title.trim() || undefined,
        description: finalDescription,
        rating,
      })

      if ("error" in result) {
        toast.error(result.error ?? "Could not save your review")
        return
      }

      toast.success(result.isUpdate ? "Your review was updated." : "Thanks for rating Reswell.")
      router.push("/reswellreviews")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background p-2">
            <Link href="/" className="flex h-full w-full items-center justify-center">
              <img
                src={RESEWELL_LOGO_SRC}
                alt="Reswell"
                className="max-h-10 w-auto max-w-full object-contain"
              />
            </Link>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">Reswell</p>
            <p className="text-sm text-muted-foreground">reswell.app</p>
          </div>
        </div>
      </div>

      {hasExistingReview ? (
        <p className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You&apos;ve already rated Reswell. Update your review below if anything has changed.
        </p>
      ) : null}

      <div className="space-y-3">
        <Label className="sr-only">Star rating</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="rounded-sm transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Rate ${value} out of 5 stars`}
              aria-pressed={rating === value}
            >
              <ReswellPlatformStarBox fill={value <= rating ? 1 : 0} size="lg" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="rate-reswell-description" className="text-base font-semibold text-foreground">
            Tell us more about your experience
          </Label>
          <button
            type="button"
            onClick={() => setShowTip((current) => !current)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-listingHeart hover:underline"
          >
            <Lightbulb className="h-4 w-4" aria-hidden />
            Want a tip?
          </button>
        </div>

        {showTip ? (
          <p className="rounded-lg border border-border/70 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-muted-foreground dark:bg-amber-950/20">
            Be specific about buying, selling, or using Reswell. Mention what went well, how support
            helped, or anything that could be better for other surfers.
          </p>
        ) : null}

        <Textarea
          id="rate-reswell-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          rows={6}
          maxLength={2000}
          placeholder="What made your experience great? What is Reswell doing well? Remember to be honest, helpful, and constructive!"
          className="min-h-[160px] resize-y rounded-lg border-border/80 text-base"
        />

        <div className="rounded-lg border border-border/70 bg-[#f7f4ef] px-4 py-4 dark:bg-muted/30">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Other people mention
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {RESWELL_REVIEW_MENTION_TAGS.slice(0, 3).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => appendMention(tag)}
                className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <Link href="/terms" className="text-sm font-medium text-listingHeart hover:underline">
          Read our Guidelines for Reviewers
        </Link>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rate-reswell-title" className="text-base font-semibold text-foreground">
          Give your review a title
        </Label>
        <Input
          id="rate-reswell-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="What's important for people to know?"
          className="rounded-lg border-border/80"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="rate-reswell-experience-date" className="text-base font-semibold text-foreground">
            Date of experience
          </Label>
          <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="relative max-w-xs">
          <Input
            id="rate-reswell-experience-date"
            type="date"
            value={experienceDate}
            onChange={(event) => setExperienceDate(event.target.value)}
            className="rounded-lg border-border/80 pr-10"
          />
          <CalendarDays
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-listingHeart"
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rate-reswell-full-name" className="text-base font-semibold text-foreground">
          Your full name
        </Label>
        <Input
          id="rate-reswell-full-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          placeholder="How your name should appear on the review"
          className="rounded-lg border-border/80"
        />
      </div>

      <div className="rounded-lg border border-border/70 bg-[#f7f4ef] px-4 py-4 dark:bg-muted/30">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-listingHeart" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Reswell doesn&apos;t allow payments or benefits in exchange for leaving a review.{" "}
            <Link href="/terms" className="font-medium text-listingHeart hover:underline">
              Learn about incentives
            </Link>
            .
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
          className="mt-0.5"
          aria-required
        />
        <span>
          By submitting this review, you confirm it&apos;s{" "}
          <Link href="/terms" className="font-medium text-listingHeart hover:underline">
            based on a genuine experience
          </Link>{" "}
          and you haven&apos;t received an incentive to write it.
        </span>
      </label>

      <Button
        type="submit"
        disabled={loading || rating < 1 || !confirmed}
        className={cn(
          "h-11 rounded-full bg-listingHeart px-8 text-white hover:bg-[#2a4170]",
          "disabled:opacity-50",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : hasExistingReview ? (
          "Update review"
        ) : (
          "Submit review"
        )}
      </Button>
    </form>
  )
}
