import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"

const RATING_LABEL: Record<SupportReplyDraftRating, string> = {
  very_good: "Very good",
  okay: "Okay",
  bad: "Bad",
}

const RATING_TONE: Record<SupportReplyDraftRating, "green" | "amber" | "red"> = {
  very_good: "green",
  okay: "amber",
  bad: "red",
}

const RATING_TOAST: Record<SupportReplyDraftRating, string> = {
  very_good: "Marked very good — later drafts will prefer this",
  okay: "Marked okay — later drafts can learn from this",
  bad: "Marked bad — later replies will avoid this when you leave a note",
}

interface SupportReplyExampleRatingProps {
  rating: SupportReplyDraftRating
  className?: string
}

export function SupportReplyExampleRating({ rating, className }: SupportReplyExampleRatingProps) {
  return <AdminStatusPill label={RATING_LABEL[rating]} tone={RATING_TONE[rating]} className={className} />
}

export function supportReplyExampleRatingLabel(rating: SupportReplyDraftRating): string {
  return RATING_LABEL[rating]
}

export function supportReplyExampleRatingToast(rating: SupportReplyDraftRating): string {
  return RATING_TOAST[rating]
}

export function supportReplyExampleRatingClass(rating: SupportReplyDraftRating, selected: boolean): string {
  if (!selected) return "hover:bg-muted hover:text-foreground"
  if (rating === "very_good") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
  if (rating === "okay") return "bg-amber-500/15 text-amber-900 dark:text-amber-200"
  return "bg-destructive/10 text-destructive"
}
