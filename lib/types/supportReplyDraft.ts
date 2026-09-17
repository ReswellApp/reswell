import type {
  SupportReplyDraftOrigin,
  SupportReplyDraftRating,
} from "@/lib/validations/supportReplyDraft"

export type SupportReplyCitedHelp = {
  slug: string
  topicId: string
  title: string
  href: string
}

export type SupportReplyCitedOrder = {
  id: string
  orderRef: string
}

export type SupportReplyCitedTicket = {
  id: string
  subject: string
  href: string
}

export type SupportReplyDraftCitations = {
  orders: SupportReplyCitedOrder[]
  tickets: SupportReplyCitedTicket[]
}

export type SupportReplyDraftView = {
  id: string
  caseId: string
  body: string
  origin: SupportReplyDraftOrigin
  model: string | null
  reason: string | null
  citedHelp: SupportReplyCitedHelp[]
  citedOrders: SupportReplyCitedOrder[]
  citedTickets: SupportReplyCitedTicket[]
  needsHumanReview: boolean
  cached: boolean
}

export type SupportReplyDraftRow = {
  id: string
  case_id: string
  body: string
  model: string | null
  prompt_version: string
  source_fingerprint: string
  cited_help_slugs: string[]
  retrieved_example_ids: string[]
  origin: SupportReplyDraftOrigin
  reason: string | null
  citations: SupportReplyDraftCitations
  created_at: string
  updated_at: string
}

export type SupportReplyExampleRow = {
  id: string
  case_id: string | null
  kind: string | null
  customer_excerpt: string
  staff_reply: string
  cited_help_slugs: string[]
  rating: SupportReplyDraftRating
  draft_id: string | null
  rated_by: string | null
  source_channel: string | null
  rating_note: string | null
  created_at: string
}

export type SupportReplyExampleCitedHelp = {
  slug: string
  title: string
  href: string
}

export type SupportReplyExampleAdminView = {
  id: string
  caseId: string | null
  kind: string | null
  customerExcerpt: string
  staffReply: string
  citedHelpSlugs: string[]
  citedHelp: SupportReplyExampleCitedHelp[]
  rating: SupportReplyDraftRating
  draftId: string | null
  ratedBy: string | null
  createdAt: string
}

export type SupportReplyExampleRatingCounts = {
  all: number
  very_good: number
  okay: number
  bad: number
}

export type SupportReplyExampleListResult = {
  items: SupportReplyExampleAdminView[]
  total: number
  page: number
  limit: number
  counts: SupportReplyExampleRatingCounts
}

export type SupportReplyRootPromptView = {
  body: string
  updatedAt: string | null
}
