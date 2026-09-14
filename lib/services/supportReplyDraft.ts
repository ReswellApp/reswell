import { generateText, Output } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  getSupportCaseById,
  listSupportCaseMessages,
  resolveSupportCaseByAnyId,
  type SupportCaseMessageRow,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import {
  getSupportReplyDraftByCaseId,
  getSupportReplyOrderSnapshot,
  getSupportReplyRequesterNames,
  insertSupportReplyExample,
  listOpenCaseIdsNeedingDraft,
  upsertSupportReplyDraft,
  type SupportReplyOrderSnapshot,
} from "@/lib/db/supportReplyDrafts"
import { supportReplyGreetingName } from "@/lib/utils/support-reply-greeting"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import {
  citedHelpFromSlugs,
  gatherSupportReplyKnowledge,
  SUPPORT_REPLY_PROMPT_VERSION,
  type SupportReplyKnowledge,
} from "@/lib/services/supportReplyKnowledge"
import type { SupportReplyCitedHelp, SupportReplyDraftView } from "@/lib/types/supportReplyDraft"
import {
  supportReplyDraftCaseIdSchema,
  supportReplyDraftFeedbackSchema,
  supportReplyDraftLlmSchema,
  type SupportReplyDraftOrigin,
} from "@/lib/validations/supportReplyDraft"
import {
  collectCustomerSupportTexts,
  lastCustomerSupportText,
  supportReplyDraftFingerprint,
} from "@/lib/utils/support-reply-retrieve"

const FEATURE = APP_LLM_FEATURES.find((f) => f.id === "support_reply_draft")

export function supportReplyDraftModelId(): string {
  if (!FEATURE) return "google/gemini-2.5-flash"
  return resolveConfiguredModel(FEATURE)
}

export function isSupportReplyDraftLlmEnabled(): boolean {
  if (!FEATURE) return false
  return isAppLlmFeatureEnabled(FEATURE)
}

function staffClient() {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

async function requireStaffService(): Promise<
  { ok: true; userId: string; service: SupabaseClient } | { ok: false; error: string }
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

  return { ok: true, userId: user.id, service: staffClient() ?? supabase }
}

function lastCustomerText(row: SupportCaseRow, messages: SupportCaseMessageRow[]): string {
  return lastCustomerSupportText(messages, row.subject)
}

function lastMessageAt(messages: SupportCaseMessageRow[]): string | null {
  const last = messages[messages.length - 1]
  return last?.created_at ?? null
}

function applyMacroVars(
  body: string,
  vars: { name?: string | null; orderRef?: string | null },
): string {
  return body
    .replaceAll("{{name}}", vars.name?.trim() || "there")
    .replaceAll("{{order_ref}}", vars.orderRef?.trim() || "your order")
}

function toCitedHelp(slugs: string[]): SupportReplyCitedHelp[] {
  return citedHelpFromSlugs(slugs).map((article) => ({
    slug: article.slug,
    topicId: article.topicId,
    title: article.title,
    href: article.href,
  }))
}

function toView(
  row: {
    id: string
    case_id: string
    body: string
    origin: SupportReplyDraftOrigin
    model: string | null
    cited_help_slugs: string[]
  },
  cached: boolean,
  needsHumanReview: boolean,
): SupportReplyDraftView {
  return {
    id: row.id,
    caseId: row.case_id,
    body: row.body,
    origin: row.origin,
    model: row.model,
    citedHelp: toCitedHelp(row.cited_help_slugs),
    needsHumanReview,
    cached,
  }
}

function compactOrder(order: SupportReplyOrderSnapshot | null): string {
  if (!order) return "No order is linked."
  const parts = [
    `Order ${order.orderNum ?? order.id.slice(0, 8)}`,
    `status ${order.status}`,
    order.fulfillmentMethod ? `fulfillment ${order.fulfillmentMethod}` : null,
    order.deliveryStatus ? `delivery ${order.deliveryStatus}` : null,
    order.trackingNumber ? `tracking ${order.trackingNumber}` : null,
    `amount $${order.amount.toFixed(2)}`,
  ]
  return parts.filter(Boolean).join(" · ")
}

function knowledgePrompt(knowledge: SupportReplyKnowledge): string {
  const help = knowledge.helpArticles
    .map(
      (article) =>
        `- ${article.title} (${article.href})\n  ${article.description}\n  ${article.body.slice(0, 700)}`,
    )
    .join("\n")
  const examples = knowledge.examples
    .map(
      (example) =>
        `- [${example.rating}] customer: ${example.customerExcerpt.slice(0, 400)}\n  staff: ${example.staffReply.slice(0, 700)}`,
    )
    .join("\n")
  const macros = knowledge.macros
    .map((macro) => `- ${macro.title}: ${macro.body}`)
    .join("\n")

  return `Help center articles (current, treat as policy):
${help || "(none matched)"}

Similar sent replies Hayden approved or edited:
${examples || "(none yet — learn from future sends)"}

Saved macros (tone/structure only — adapt, do not paste blindly if facts differ):
${macros || "(none)"}`
}

function fallbackDraft(
  knowledge: SupportReplyKnowledge,
  vars: { name?: string | null; orderRef?: string | null },
): { body: string; origin: SupportReplyDraftOrigin; slugs: string[]; exampleIds: string[] } {
  const example = knowledge.examples[0]
  if (example && example.score >= 0.7) {
    return {
      body: example.staffReply,
      origin: "example",
      slugs: knowledge.helpArticles.map((article) => article.slug),
      exampleIds: [example.id].filter((id) => !id.startsWith("case:")),
    }
  }
  const macro = knowledge.macros[0]
  if (macro) {
    return {
      body: applyMacroVars(macro.body, vars),
      origin: "macro",
      slugs: knowledge.helpArticles.map((article) => article.slug),
      exampleIds: [],
    }
  }
  return {
    body: applyMacroVars(
      "Hi {{name}}, thanks for writing in. I am looking into this and will follow up shortly.",
      vars,
    ),
    origin: "macro",
    slugs: [],
    exampleIds: [],
  }
}

async function generateDraftBody(args: {
  row: SupportCaseRow
  messages: SupportCaseMessageRow[]
  knowledge: SupportReplyKnowledge
  order: SupportReplyOrderSnapshot | null
  greetingName: string
}): Promise<{
  body: string
  origin: SupportReplyDraftOrigin
  slugs: string[]
  exampleIds: string[]
  model: string | null
  needsHumanReview: boolean
}> {
  const customerBits = collectCustomerSupportTexts(args.messages, args.row.subject)

  const priorStaff = args.messages
    .filter((message) => message.author_role === "agent" && !message.is_internal)
    .map((message) => message.body.trim())
    .filter(Boolean)

  const exampleIds = args.knowledge.examples
    .map((example) => example.id)
    .filter((id) => !id.startsWith("case:"))

  if (!isSupportReplyDraftLlmEnabled()) {
    const fallback = fallbackDraft(args.knowledge, {
      name: args.greetingName,
      orderRef: args.row.order_ref,
    })
    return { ...fallback, model: null, needsHumanReview: true }
  }

  const { output } = await generateText({
    model: supportReplyDraftModelId(),
    output: Output.object({ schema: supportReplyDraftLlmSchema }),
    system: `You draft customer-service replies for Hayden at Reswell, a used-surfboard marketplace with Purchase Protection.

Write a ready-to-send reply in Hayden's voice: warm, concise, specific, first-person staff ("we" / Reswell Support). Do not mention that you are an AI.

Rules:
- Ground every policy claim in the provided help-center excerpts or similar sent replies.
- Never invent refunds, claim approvals, tracking numbers, or payouts.
- If facts are missing, ask one clear question instead of guessing.
- Do not promise a timeline Reswell has not published.
- Safety / scam reports: take them seriously, ask for the listing or conversation link, and say staff will review.
- Keep it under 180 words unless the thread needs a short numbered list.
- Sign off simply as Reswell Support (no invented personal name).
- Greet them as ${args.greetingName}. Never address them by email.
- If the last staff message already answered them, write a short follow-up, not a repeat.`,
    prompt: `Draft the next customer-visible reply.

Case: ${args.row.subject}
Kind: ${args.row.kind}
Status: ${args.row.status}
Requester: ${args.greetingName} (${args.row.requester_role})
${compactOrder(args.order)}

Customer messages:
${customerBits.slice(-6).join("\n---\n") || "(original request only)"}

Already sent by staff:
${priorStaff.slice(-4).join("\n---\n") || "(none yet)"}

${knowledgePrompt(args.knowledge)}`,
    temperature: 0.3,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature("support_reply_draft"),
      },
    },
  })

  if (!output?.reply.trim()) {
    const fallback = fallbackDraft(args.knowledge, {
      name: args.greetingName,
      orderRef: args.row.order_ref,
    })
    return { ...fallback, model: supportReplyDraftModelId(), needsHumanReview: true }
  }

  const cited = output.cited_help_slugs.filter((slug) =>
    args.knowledge.helpArticles.some((article) => article.slug === slug),
  )
  return {
    body: output.reply.trim(),
    origin: "llm",
    slugs: cited.length > 0 ? cited : args.knowledge.helpArticles.map((article) => article.slug).slice(0, 3),
    exampleIds,
    model: supportReplyDraftModelId(),
    needsHumanReview: output.needs_human_review,
  }
}

async function loadCaseContext(
  service: SupabaseClient,
  caseId: string,
): Promise<{ row: SupportCaseRow; messages: SupportCaseMessageRow[] } | { error: string }> {
  const row = (await resolveSupportCaseByAnyId(service, caseId)) ?? (await getSupportCaseById(service, caseId))
  if (!row) return { error: "Case not found." }
  const messages = await listSupportCaseMessages(service, row.id, { includeInternal: true })
  return { row, messages }
}

export async function getOrCreateSupportReplyDraftService(
  raw: unknown,
): Promise<{ data: SupportReplyDraftView } | { error: string }> {
  const parsed = supportReplyDraftCaseIdSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }

  return generateAndStoreDraft(staff.service, parsed.data.case_id, parsed.data.force === true)
}

export async function generateAndStoreDraft(
  service: SupabaseClient,
  caseId: string,
  force = false,
): Promise<{ data: SupportReplyDraftView } | { error: string }> {
  const loaded = await loadCaseContext(service, caseId)
  if ("error" in loaded) return loaded

  const { row, messages } = loaded
  const lastCustomer = lastCustomerText(row, messages)
  const fingerprint = supportReplyDraftFingerprint({
    promptVersion: SUPPORT_REPLY_PROMPT_VERSION,
    caseId: row.id,
    subject: row.subject,
    status: row.status,
    lastCustomerMessage: lastCustomer,
    lastMessageAt: lastMessageAt(messages),
  })

  if (!force) {
    const existing = await getSupportReplyDraftByCaseId(service, row.id)
    if (existing && existing.source_fingerprint === fingerprint && existing.body.trim()) {
      return { data: toView(existing, true, false) }
    }
  }

  const query = [row.subject, row.kind, lastCustomer].filter(Boolean).join(" ")
  const [knowledge, order, names] = await Promise.all([
    gatherSupportReplyKnowledge(service, {
      query,
      kind: row.kind,
      excludeCaseId: row.id,
    }),
    row.order_id ? getSupportReplyOrderSnapshot(service, row.order_id) : Promise.resolve(null),
    getSupportReplyRequesterNames(service, row),
  ])
  const greetingName = supportReplyGreetingName({
    contactName: names.contactName,
    displayName: names.displayName,
    role: row.requester_role,
  })

  let generated
  try {
    generated = await generateDraftBody({ row, messages, knowledge, order, greetingName })
  } catch (error) {
    console.error("[supportReplyDraft] generate failed:", error)
    const fallback = fallbackDraft(knowledge, {
      name: greetingName,
      orderRef: row.order_ref,
    })
    generated = { ...fallback, model: null, needsHumanReview: true }
  }

  const saved = await upsertSupportReplyDraft(service, {
    caseId: row.id,
    body: generated.body,
    model: generated.model,
    promptVersion: SUPPORT_REPLY_PROMPT_VERSION,
    sourceFingerprint: fingerprint,
    citedHelpSlugs: generated.slugs,
    retrievedExampleIds: generated.exampleIds,
    origin: generated.origin,
  })
  if (!saved) return { error: "Could not save the draft." }

  return { data: toView(saved, false, generated.needsHumanReview) }
}

export async function recordSupportReplyFeedbackService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = supportReplyDraftFeedbackSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid feedback." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }

  const loaded = await loadCaseContext(staff.service, parsed.data.case_id)
  if ("error" in loaded) return loaded

  const draft = await getSupportReplyDraftByCaseId(staff.service, loaded.row.id)
  const staffReply = (parsed.data.sent_body?.trim() || draft?.body || "").trim()
  if (!staffReply) return { error: "Nothing to rate yet." }

  await insertSupportReplyExample(staff.service, {
    caseId: loaded.row.id,
    kind: loaded.row.kind,
    customerExcerpt: lastCustomerText(loaded.row, loaded.messages),
    staffReply,
    citedHelpSlugs: draft?.cited_help_slugs ?? [],
    rating: parsed.data.rating,
    draftId: parsed.data.draft_id ?? draft?.id ?? null,
    ratedBy: staff.userId,
  })

  return { success: true }
}

export async function recordSentSupportReplyExample(args: {
  caseId: string
  sentBody: string
  staffUserId: string | null
}): Promise<void> {
  try {
    const service = staffClient()
    if (!service) return
    const loaded = await loadCaseContext(service, args.caseId)
    if ("error" in loaded) return

    const draft = await getSupportReplyDraftByCaseId(service, loaded.row.id)
    const sent = args.sentBody.trim()
    if (!sent) return

    const rating =
      draft?.body.trim() && draft.body.trim() === sent
        ? "accepted"
        : draft?.body.trim()
          ? "edited"
          : "accepted"

    await insertSupportReplyExample(service, {
      caseId: loaded.row.id,
      kind: loaded.row.kind,
      customerExcerpt: lastCustomerText(loaded.row, loaded.messages),
      staffReply: sent,
      citedHelpSlugs: draft?.cited_help_slugs ?? [],
      rating,
      draftId: draft?.id ?? null,
      ratedBy: args.staffUserId,
    })
  } catch (error) {
    console.warn("[supportReplyDraft] learn-from-send skipped:", error)
  }
}

export async function warmOpenSupportReplyDraftsService(limit = 12): Promise<{
  warmed: number
  skipped: number
  errors: number
}> {
  const service = createServiceRoleClient()
  const ids = await listOpenCaseIdsNeedingDraft(service, limit)
  let warmed = 0
  let errors = 0
  for (const id of ids) {
    const result = await generateAndStoreDraft(service, id, false)
    if ("error" in result) errors += 1
    else warmed += 1
  }
  return { warmed, skipped: 0, errors }
}
