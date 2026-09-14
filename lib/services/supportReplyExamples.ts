import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import {
  countSupportReplyExamples,
  deleteSupportReplyExample,
  getSupportReplyExampleById,
  listSupportReplyExamplesPage,
  updateSupportReplyExample,
} from "@/lib/db/supportReplyDrafts"
import { citedHelpFromSlugs } from "@/lib/services/supportReplyKnowledge"
import { clampSupportReplyExamplesPage } from "@/lib/utils/support-reply-examples"
import type {
  SupportReplyExampleAdminView,
  SupportReplyExampleListResult,
  SupportReplyExampleRatingCounts,
  SupportReplyExampleRow,
} from "@/lib/types/supportReplyDraft"
import {
  SUPPORT_REPLY_DRAFT_RATINGS,
  SUPPORT_REPLY_EXAMPLE_PAGE_SIZE,
  parseSupportReplyExampleListParams,
  supportReplyExampleDeleteSchema,
  supportReplyExampleUpdateSchema,
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
  const [all, accepted, edited, rejected] = await Promise.all([
    countSupportReplyExamples(supabase, filters),
    ...SUPPORT_REPLY_DRAFT_RATINGS.map((rating) =>
      countSupportReplyExamples(supabase, { ...filters, rating }),
    ),
  ])
  return { all, accepted, edited, rejected }
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
