import { AdminStatusPill } from "@/components/features/admin/admin-status-pill"
import type { SupportReplyDraftRating } from "@/lib/validations/supportReplyDraft"

const RATING_LABEL: Record<SupportReplyDraftRating, string> = {
  accepted: "Accepted",
  edited: "Edited",
  rejected: "Rejected",
}

const RATING_TONE: Record<SupportReplyDraftRating, "green" | "amber" | "red"> = {
  accepted: "green",
  edited: "amber",
  rejected: "red",
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
