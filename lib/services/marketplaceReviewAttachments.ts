import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET,
  MARKETPLACE_REVIEW_MAX_PHOTOS,
  marketplaceReviewAttachmentInputSchema,
  marketplaceReviewAttachmentsMetadataSchema,
  parseMarketplaceReviewImageAttachments,
  type MarketplaceReviewAttachmentInput,
  type MarketplaceReviewImageAttachment,
} from "@/lib/validations/marketplace-review-attachment"

export type MarketplaceReviewAttachmentDownloadAuthResult =
  | {
      ok: true
      bucket: string
      path: string
      fileName: string
      mimeType: string
    }
  | { ok: false; error: string; status: number }

export type MarketplaceReviewMetadataResult =
  | { ok: true; metadata: { attachments: MarketplaceReviewImageAttachment[] } | null }
  | { ok: false; error: string }

function attachmentPathBelongsToReviewer(path: string, reviewerId: string): boolean {
  const prefix = `${reviewerId}/`
  if (!path.startsWith(prefix) || path.length <= prefix.length) return false
  if (path.includes("..") || path.includes("//")) return false
  const rest = path.slice(prefix.length)
  return rest.length > 0 && !rest.includes("/")
}

async function objectExistsInReviewerFolder(reviewerId: string, path: string): Promise<boolean> {
  const service = createServiceRoleClient()
  const objectName = path.slice(reviewerId.length + 1)
  const { data: listed, error: listErr } = await service.storage
    .from(MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET)
    .list(reviewerId, { search: objectName, limit: 1 })

  return !listErr && Boolean(listed?.some((obj) => obj.name === objectName))
}

function parseAttachmentInputs(
  attachmentsInput: unknown,
): { ok: true; data: MarketplaceReviewAttachmentInput[] } | { ok: false; error: string } {
  if (attachmentsInput == null) {
    return { ok: true, data: [] }
  }
  if (!Array.isArray(attachmentsInput)) {
    return { ok: false, error: "Invalid photo attachment" }
  }
  if (attachmentsInput.length > MARKETPLACE_REVIEW_MAX_PHOTOS) {
    return { ok: false, error: `You can add up to ${MARKETPLACE_REVIEW_MAX_PHOTOS} photos.` }
  }

  const data: MarketplaceReviewAttachmentInput[] = []
  for (const item of attachmentsInput) {
    const parsed = marketplaceReviewAttachmentInputSchema.safeParse(item)
    if (!parsed.success) {
      return { ok: false, error: "Invalid photo attachment" }
    }
    data.push(parsed.data)
  }
  return { ok: true, data }
}

/** Confirm uploaded objects exist and belong to the reviewer, then stamp the bucket. */
export async function resolveMarketplaceReviewAttachmentMetadata(
  reviewerId: string,
  attachmentsInput: unknown,
): Promise<MarketplaceReviewMetadataResult> {
  const parsedInputs = parseAttachmentInputs(attachmentsInput)
  if (!parsedInputs.ok) {
    return { ok: false, error: parsedInputs.error }
  }
  if (parsedInputs.data.length === 0) {
    return { ok: true, metadata: null }
  }

  const attachments: MarketplaceReviewImageAttachment[] = []
  const seenPaths = new Set<string>()

  for (const input of parsedInputs.data) {
    if (seenPaths.has(input.path)) {
      return { ok: false, error: "Duplicate photo attachment" }
    }
    seenPaths.add(input.path)

    const attachment: MarketplaceReviewImageAttachment = {
      ...input,
      bucket: MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET,
    }
    if (!attachmentPathBelongsToReviewer(attachment.path, reviewerId)) {
      return { ok: false, error: "Invalid photo path" }
    }

    const exists = await objectExistsInReviewerFolder(reviewerId, attachment.path)
    if (!exists) {
      return { ok: false, error: "Photo upload not found — try adding the photo again" }
    }

    attachments.push(attachment)
  }

  const metaParsed = marketplaceReviewAttachmentsMetadataSchema.safeParse({ attachments })
  if (!metaParsed.success) {
    return { ok: false, error: "Invalid photo attachment" }
  }

  return { ok: true, metadata: metaParsed.data }
}

/** Public marketplace reviews — anyone may load attachment bytes via the app proxy. */
export async function authorizeMarketplaceReviewAttachmentDownload(
  reviewId: string,
  index: number,
): Promise<MarketplaceReviewAttachmentDownloadAuthResult> {
  const sr = createServiceRoleClient()
  const { data: review, error: reviewErr } = await sr
    .from("reviews")
    .select("id, metadata")
    .eq("id", reviewId)
    .maybeSingle()

  if (reviewErr || !review) {
    return { ok: false, error: "Review not found", status: 404 }
  }

  const attachments = parseMarketplaceReviewImageAttachments(review.metadata)
  const attachment = attachments[index]
  if (!attachment) {
    return { ok: false, error: "Photo not found", status: 404 }
  }

  return {
    ok: true,
    bucket: attachment.bucket,
    path: attachment.path,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
  }
}
