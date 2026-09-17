import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  countSupportReplyExamples,
  deleteSupportReplyExample,
  getSupportReplyExampleById,
  listSupportReplyExamplesPage,
  updateSupportReplyExample,
} from "@/lib/db/supportReplyDrafts"
import {
  getSupportReplyLiveChatPromptBody,
  getSupportReplyPromptById,
  getSupportReplyRootPrompt,
  SUPPORT_REPLY_LIVE_CHAT_PROMPT_ID,
  upsertSupportReplyLiveChatPrompt,
  upsertSupportReplyRootPrompt,
} from "@/lib/db/supportReplyRootPrompt"
import { DEFAULT_SUPPORT_REPLY_ROOT_PROMPT } from "@/lib/llm/cs-agent"
import { DEFAULT_LIVE_CHAT_REPLY_PROMPT } from "@/lib/live-chat/live-chat-cs-prompt"
import { citedHelpFromSlugs } from "@/lib/services/supportReplyKnowledge"
import { clampSupportReplyExamplesPage } from "@/lib/utils/support-reply-examples"
import type {
  SupportReplyExampleAdminView,
  SupportReplyExampleListResult,
  SupportReplyExampleRatingCounts,
  SupportReplyExampleRow,
  SupportReplyRootPromptView,
} from "@/lib/types/supportReplyDraft"
import {
  SUPPORT_REPLY_DRAFT_RATINGS,
  SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  parseSupportReplyExampleListParams,
  supportReplyExampleDeleteSchema,
  supportReplyExampleUpdateSchema,
  supportReplyRootPromptSchema,
} from "@/lib/validations/supportReplyDraft"

type ServiceError = { error: string }

async function requireStaff(): Promise<
  { ok: true; supabase: SupabaseClient } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, supabase }
}

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function toCitedHelp(slugs: string[]): SupportReplyExampleAdminView["citedHelp"] {
  const found = citedHelpFromSlugs(slugs)
  const bySlug = new Map(found.map((article) => [article.slug, article]))
  return slugs.map((slug) => {
    const article = bySlug.get(slug)
    return {
      slug,
      title: article?.title ?? slug,
      href: article?.href ?? `/help/${slug}`,
    }
  })
}

export function toSupportReplyExampleAdminView(
  row: SupportReplyExampleRow,
): SupportReplyExampleAdminView {
  return {
    id: row.id,
    caseId: row.case_id,
    kind: row.kind,
    customerExcerpt: row.customer_excerpt,
    staffReply: row.staff_reply,
    citedHelpSlugs: row.cited_help_slugs,
    citedHelp: toCitedHelp(row.cited_help_slugs),
    rating: row.rating,
    draftId: row.draft_id,
    ratedBy: row.rated_by,
    createdAt: row.created_at,
  }
}

async function ratingCounts(
  supabase: SupabaseClient,
  filters: { kind?: string; q?: string },
): Promise<SupportReplyExampleRatingCounts> {
  const [all, ...perRating] = await Promise.all([
    countSupportReplyExamples(supabase, filters),
    ...SUPPORT_REPLY_DRAFT_RATINGS.map((rating) =>
      countSupportReplyExamples(supabase, { ...filters, rating }),
    ),
  ])
  return {
    all,
    very_good: perRating[0] ?? 0,
    okay: perRating[1] ?? 0,
    bad: perRating[2] ?? 0,
  }
}

export async function listAdminSupportReplyExamplesService(
  raw: unknown,
): Promise<{ data: SupportReplyExampleListResult } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const parsed = parseSupportReplyExampleListParams(raw)
  const page = parsed.page ?? 1
  const limit = parsed.limit ?? SUPPORT_REPLY_EXAMPLE_PAGE_SIZE
  const filters = {
    rating: parsed.rating,
    kind: parsed.kind,
    q: parsed.q,
  }

  const [listed, counts] = await Promise.all([
    listSupportReplyExamplesPage(staff.supabase, {
      ...filters,
      offset: (page - 1) * limit,
      limit,
    }),
    ratingCounts(staff.supabase, { kind: filters.kind, q: filters.q }),
  ])

  if ("error" in listed) return listed

  const safePage = clampSupportReplyExamplesPage(page, listed.total, limit)
  if (safePage !== page) {
    const relisted = await listSupportReplyExamplesPage(staff.supabase, {
      ...filters,
      offset: (safePage - 1) * limit,
      limit,
    })
    if ("error" in relisted) return relisted
    return {
      data: {
        items: relisted.rows.map(toSupportReplyExampleAdminView),
        total: relisted.total,
        page: safePage,
        limit,
        counts,
      },
    }
  }

  return {
    data: {
      items: listed.rows.map(toSupportReplyExampleAdminView),
      total: listed.total,
      page: safePage,
      limit,
      counts,
    },
  }
}

export async function updateAdminSupportReplyExampleService(
  raw: unknown,
): Promise<{ success: true; data: SupportReplyExampleAdminView } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const parsed = supportReplyExampleUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }

  const existing = await getSupportReplyExampleById(staff.supabase, parsed.data.id)
  if (!existing) return { error: "Example not found." }

  const saved = await updateSupportReplyExample(staff.supabase, {
    id: parsed.data.id,
    customerExcerpt: parsed.data.customer_excerpt,
    staffReply: parsed.data.staff_reply,
    citedHelpSlugs: parsed.data.cited_help_slugs,
    rating: parsed.data.rating,
    kind: parsed.data.kind,
  })
  if ("error" in saved) return saved

  return { success: true, data: toSupportReplyExampleAdminView(saved) }
}

export async function deleteAdminSupportReplyExampleService(
  raw: unknown,
): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const parsed = supportReplyExampleDeleteSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid example." }

  const existing = await getSupportReplyExampleById(staff.supabase, parsed.data.id)
  if (!existing) return { error: "Example not found." }

  return deleteSupportReplyExample(staff.supabase, parsed.data.id)
}

export async function getAdminSupportReplyRootPromptService(): Promise<
  { data: SupportReplyRootPromptView } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getSupportReplyRootPrompt(staff.supabase)
  return {
    data: {
      body: row?.body.trim() || DEFAULT_SUPPORT_REPLY_ROOT_PROMPT,
      updatedAt: row?.updated_at || null,
    },
  }
}

export async function updateAdminSupportReplyRootPromptService(
  raw: unknown,
): Promise<{ success: true; data: SupportReplyRootPromptView } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const parsed = supportReplyRootPromptSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }

  const {
    data: { user },
  } = await staff.supabase.auth.getUser()

  const saved = await upsertSupportReplyRootPrompt(
    staff.supabase,
    parsed.data.body,
    user?.id ?? null,
  )
  if ("error" in saved) return saved

  return {
    success: true,
    data: {
      body: saved.body,
      updatedAt: saved.updated_at,
    },
  }
}

export async function getAdminSupportReplyLiveChatPromptService(): Promise<
  { data: SupportReplyRootPromptView } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getSupportReplyPromptById(staff.supabase, SUPPORT_REPLY_LIVE_CHAT_PROMPT_ID)
  return {
    data: {
      body: row?.body.trim() || DEFAULT_LIVE_CHAT_REPLY_PROMPT,
      updatedAt: row?.updated_at || null,
    },
  }
}

export async function updateAdminSupportReplyLiveChatPromptService(
  raw: unknown,
): Promise<{ success: true; data: SupportReplyRootPromptView } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const parsed = supportReplyRootPromptSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }

  const {
    data: { user },
  } = await staff.supabase.auth.getUser()

  const saved = await upsertSupportReplyLiveChatPrompt(
    staff.supabase,
    parsed.data.body,
    user?.id ?? null,
  )
  if ("error" in saved) return saved

  return {
    success: true,
    data: {
      body: saved.body,
      updatedAt: saved.updated_at,
    },
  }
}

/** Service-role helper for live-chat auto-send generation. */
export async function loadLiveChatReplyPromptBody(svc: Parameters<
  typeof getSupportReplyLiveChatPromptBody
>[0]): Promise<string> {
  return getSupportReplyLiveChatPromptBody(svc)
}
