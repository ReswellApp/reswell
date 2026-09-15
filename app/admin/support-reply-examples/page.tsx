import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { listAdminSupportReplyExamplesService } from "@/lib/services/supportReplyExamples"
import { SupportReplyExamplesAdminClient } from "@/components/features/admin/support-reply-examples/support-reply-examples-admin-client"
import {
  SUPPORT_REPLY_EXAMPLES_PATH,
  supportReplyExamplesHref,
} from "@/lib/utils/support-reply-examples"
import {
  SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  parseSupportReplyExampleListParams,
} from "@/lib/validations/supportReplyDraft"
import type { SupportReplyExampleListResult } from "@/lib/types/supportReplyDraft"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Reply examples — Admin — Reswell",
  description: "Review, edit, and delete sent support replies the draft model learns from.",
  path: SUPPORT_REPLY_EXAMPLES_PATH,
})

const EMPTY: SupportReplyExampleListResult = {
  items: [],
  total: 0,
  page: 1,
  limit: SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  counts: { all: 0, accepted: 0, edited: 0, rejected: 0 },
}

interface AdminSupportReplyExamplesPageProps {
  searchParams: Promise<{
    rating?: string
    kind?: string
    q?: string
    page?: string
  }>
}

export default async function AdminSupportReplyExamplesPage({
  searchParams,
}: AdminSupportReplyExamplesPageProps) {
  const raw = await searchParams
  const filters = parseSupportReplyExampleListParams(raw)
  const loaded = await listAdminSupportReplyExamplesService(filters)
  if ("data" in loaded && loaded.data.page !== (filters.page ?? 1)) {
    redirect(
      supportReplyExamplesHref({
        rating: filters.rating,
        kind: filters.kind,
        q: filters.q,
        page: loaded.data.page,
      }),
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reply examples</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sent and rated replies that later drafts retrieve as few-shot memory. Edit tone, mark a
          row rejected so it is ignored, or delete it.
        </p>
      </div>
      <SupportReplyExamplesAdminClient
        result={"data" in loaded ? loaded.data : EMPTY}
        filters={{ rating: filters.rating, kind: filters.kind, q: filters.q }}
        error={"error" in loaded ? loaded.error : undefined}
      />
    </div>
  )
}
