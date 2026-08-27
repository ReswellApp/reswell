import { parseMarketplaceReviewImageAttachments } from "@/lib/validations/marketplace-review-attachment"
import type {
  ExistingMarketplaceReview,
  MarketplaceReviewPhotoRef,
} from "@/lib/types/marketplace-review"

export function isReviewsMetadataColumnMissing(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  const code = (error?.code ?? "").toUpperCase()
  const msg = (error?.message ?? "").toLowerCase()
  if (!msg.includes("metadata")) return false
  return (
    code === "PGRST204" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  )
}

export function marketplaceReviewPhotoRefs(metadata: unknown): MarketplaceReviewPhotoRef[] {
  return parseMarketplaceReviewImageAttachments(metadata).map((attachment) => ({
    fileName: attachment.file_name,
  }))
}

export function marketplaceReviewAttachmentUrl(reviewId: string, index: number): string {
  return `/api/reviews/${encodeURIComponent(reviewId)}/attachments/${index}`
}

export function existingMarketplaceReviewFromRow(row: {
  id: string
  rating: number
  comment: string | null
  created_at: string
  metadata?: unknown
}): ExistingMarketplaceReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    photos: marketplaceReviewPhotoRefs(row.metadata),
  }
}
