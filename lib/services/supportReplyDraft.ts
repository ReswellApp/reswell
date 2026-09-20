import { after } from "next/server"
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
import { applySupportMacroVars, type SupportMacroVars } from "@/lib/utils/apply-support-macro-vars"
import { supportMacroVarsFromOrder } from "@/lib/utils/support-macro-order-vars"
import { supportReplyGreetingName } from "@/lib/utils/support-reply-greeting"
import {
  APP_LLM_FEATURES,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { defaultCsAgentReason, type CsAgentThreadTurn } from "@/lib/llm/cs-agent"
import { generateCsAgentDraft } from "@/lib/llm/cs-agent-generate"
import { getSupportReplyRootPromptBody } from "@/lib/db/supportReplyRootPrompt"
import {
  createCsAgentLookups,
  listPriorTicketsForCsAgent,
  loadLiveChatAccountSnapshot,
} from "@/lib/services/csAgentLookups"
import { listLiveChatMessagesForSession, type LiveChatSessionRow } from "@/lib/db/liveChat"
import { isLiveChatJoinMessage } from "@/lib/live-chat/human-feel"
import { latestLiveChatVisitorContent } from "@/lib/live-chat/thread-sync"
import { liveChatWriterNeedsTools } from "@/lib/live-chat/order-tile-intent"
import type { LiveChatActionActor } from "@/lib/services/liveChatActionPolicy"
import { resolveLiveChatFallbackReply } from "@/lib/live-chat/live-chat-cs-prompt"
import { citationsFromAgent } from "@/lib/utils/cs-agent-citations"
import {
  citedHelpFromSlugs,
  gatherSupportReplyKnowledge,
  SUPPORT_REPLY_PROMPT_VERSION,
  type SupportReplyKnowledge,
} from "@/lib/services/supportReplyKnowledge"
import type {
  SupportReplyCitedHelp,
  SupportReplyDraftCitations,
  SupportReplyDraftRow,
  SupportReplyDraftView,
} from "@/lib/types/supportReplyDraft"
import {
  supportReplyDraftCaseIdSchema,
  supportReplyDraftFeedbackSchema,
  supportReplyRatingForSentBody,
  type SupportReplyDraftOrigin,
} from "@/lib/validations/supportReplyDraft"
import {
  lastCustomerSupportText,
  scoreSupportReplyOverlap,
  supportReplyDraftFingerprint,
  supportReplyDraftWorkerOrigin,
  supportReplyRetrievalQuery,
  tokenizeSupportReplyQuery,
  visibleSupportConversation,
} from "@/lib/utils/support-reply-retrieve"

const FEATURE = APP_LLM_FEATURES.find((f) => f.id === "support_reply_draft")

export function supportReplyDraftModelId(): string {
  if (!FEATURE) return "google/gemini-2.5-flash"
  return resolveConfiguredModel(FEATURE)
}

const LIVE_CHAT_FEATURE = APP_LLM_FEATURES.find((f) => f.id === "live_chat_cs")

/** Frontier live-chat writer (Claude Sonnet 4.5 by default). Falls back to the inbox model if disabled. */
export function liveChatCsModelId(): string {
  if (!LIVE_CHAT_FEATURE || !isAppLlmFeatureEnabled(LIVE_CHAT_FEATURE)) {
    return supportReplyDraftModelId()
  }
  return resolveConfiguredModel(LIVE_CHAT_FEATURE)
}

export function isSupportReplyDraftLlmEnabled(): boolean {
  if (!FEATURE) return false
  return isAppLlmFeatureEnabled(FEATURE)
}

export function isLiveChatCsLlmEnabled(): boolean {
  if (LIVE_CHAT_FEATURE && isAppLlmFeatureEnabled(LIVE_CHAT_FEATURE)) return true
  return isSupportReplyDraftLlmEnabled()
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

async function loadLiveChatWriterTurns(
  service: SupabaseClient,
  sessionId: string,
  latestVisitorMessage?: string,
): Promise<{ lastCustomer: string; turns: CsAgentThreadTurn[] }> {
  const rows = await listLiveChatMessagesForSession(service, sessionId, { limit: 24 })
  const turns: CsAgentThreadTurn[] = rows
    .filter((message) => message.content.trim() && !isLiveChatJoinMessage(message.content))
    .map((message) => ({
      role:
        message.sender_type === "visitor"
          ? "customer"
          : message.sender_type === "agent"
            ? "staff"
            : "system",
      body: message.content.trim(),
    }))
  const lastVisitor = [...turns].reverse().find((turn) => turn.role === "customer")
  const latest = latestVisitorMessage?.trim() || ""
  if (latest && lastVisitor?.body !== latest) {
    turns.push({ role: "customer", body: latest })
  }
  return { lastCustomer: latest || lastVisitor?.body || "", turns }
}

function lastMessageAt(messages: SupportCaseMessageRow[]): string | null {
  const last = messages[messages.length - 1]
  return last?.created_at ?? null
}

function draftMacroVars(
  name: string,
  orderRef: string | null,
  order: SupportReplyOrderSnapshot | null,
): SupportMacroVars {
  return supportMacroVarsFromOrder({
    name,
    order_ref: orderRef,
    tracking: order?.trackingNumber ?? null,
    order: order
      ? {
          status: order.status,
          fulfillment_method: order.fulfillmentMethod,
          delivery_status: order.deliveryStatus,
          tracking_carrier: order.trackingCarrier,
          carrier_delivered_at: order.carrierDeliveredAt,
        }
      : null,
  })
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
    reason?: string | null
    citations?: SupportReplyDraftCitations
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
    reason: row.reason ?? null,
    citedHelp: toCitedHelp(row.cited_help_slugs),
    citedOrders: row.citations?.orders ?? [],
    citedTickets: row.citations?.tickets ?? [],
    needsHumanReview,
    cached,
  }
}

function fallbackDraft(
  knowledge: SupportReplyKnowledge,
  vars: SupportMacroVars,
  lastCustomerMessage = "",
): {
  body: string
  origin: SupportReplyDraftOrigin
  slugs: string[]
  exampleIds: string[]
  reason: string
  citations: SupportReplyDraftCitations
} {
  const example = knowledge.examples[0]
  const lastTokens = tokenizeSupportReplyQuery(lastCustomerMessage)
  const exampleMatchesLast =
    !example ||
    lastTokens.length === 0 ||
    scoreSupportReplyOverlap(
      lastTokens,
      `${example.customerExcerpt} ${example.staffReply}`,
    ) >= 0.5
  if (example && example.score >= 0.7 && exampleMatchesLast) {
    return {
      body: example.staffReply,
      origin: "example",
      slugs: knowledge.helpArticles.map((article) => article.slug),
      exampleIds: [example.id].filter((id) => !id.startsWith("case:")),
      reason: defaultCsAgentReason({
        origin: "example",
        hasOrder: false,
        hasTickets: false,
        helpTitles: knowledge.helpArticles.map((article) => article.title),
      }),
      citations: { orders: [], tickets: [] },
    }
  }
  const macro = knowledge.macros[0]
  if (macro) {
    return {
      body: applySupportMacroVars(macro.body, vars),
      origin: "macro",
      slugs: knowledge.helpArticles.map((article) => article.slug),
      exampleIds: [],
      reason: defaultCsAgentReason({
        origin: "macro",
        hasOrder: false,
        hasTickets: false,
        helpTitles: knowledge.helpArticles.map((article) => article.title),
      }),
      citations: { orders: [], tickets: [] },
    }
  }
  return {
    body: applySupportMacroVars(
      "Hi {{name}}, thanks for writing in. I am looking into this and will follow up shortly.",
      vars,
    ),
    origin: "macro",
    slugs: [],
    exampleIds: [],
    reason: defaultCsAgentReason({
      origin: "macro",
      hasOrder: false,
      hasTickets: false,
      helpTitles: [],
    }),
    citations: { orders: [], tickets: [] },
  }
}

async function generateDraftBody(args: {
  service: SupabaseClient
  row: SupportCaseRow
  messages: SupportCaseMessageRow[]
  knowledge: SupportReplyKnowledge
  order: SupportReplyOrderSnapshot | null
  greetingName: string
  rootPrompt: string
  rewriteInstruction?: string
  currentDraft?: string
  liveChatSession?: LiveChatSessionRow
  liveChatActor?: LiveChatActionActor
  modelId?: string
  latestVisitorMessage?: string
  liveChatRegenerate?: {
    previousReply: string
    rating?: string
    note?: string | null
  }
}): Promise<{
  body: string
  origin: SupportReplyDraftOrigin
  slugs: string[]
  exampleIds: string[]
  model: string | null
  needsHumanReview: boolean
  closeTicket: boolean
  reason: string
  citations: SupportReplyDraftCitations
}> {
  const caseLastCustomer = lastCustomerText(args.row, args.messages)
  const liveChat = args.liveChatSession
    ? await loadLiveChatWriterTurns(args.service, args.liveChatSession.id, args.latestVisitorMessage)
    : { lastCustomer: args.latestVisitorMessage?.trim() || caseLastCustomer, turns: [] }
  const lastCustomerMessage = liveChat.lastCustomer || caseLastCustomer
  const thread = liveChat.turns.length > 0 ? liveChat.turns : visibleSupportConversation(args.messages)

  const exampleIds = args.knowledge.examples
    .map((example) => example.id)
    .filter((id) => !id.startsWith("case:"))
  const isLiveChat = args.row.source_channel === "live_chat"
  const modelId = isLiveChat
    ? (args.modelId?.trim() || liveChatCsModelId())
    : supportReplyDraftModelId()

  if (isLiveChat ? !isLiveChatCsLlmEnabled() : !isSupportReplyDraftLlmEnabled()) {
    if (isLiveChat) {
      return {
        body: resolveLiveChatFallbackReply(lastCustomerMessage),
        origin: "macro",
        slugs: [],
        exampleIds: [],
        model: null,
        needsHumanReview: true,
        closeTicket: false,
        reason: "Live chat model is off.",
        citations: { orders: [], tickets: [] },
      }
    }
    const fallback = fallbackDraft(
      args.knowledge,
      draftMacroVars(args.greetingName, args.row.order_ref, args.order),
      lastCustomerMessage,
    )
    return { ...fallback, model: null, needsHumanReview: true, closeTicket: false }
  }

  const [priorTickets, accountSnapshot] = await Promise.all([
    listPriorTicketsForCsAgent(args.service, {
      caseId: args.row.id,
      requesterUserId: args.row.requester_user_id,
      requesterEmail: args.row.requester_email,
      linkedOrderId: args.row.order_id,
    }),
    isLiveChat
      ? loadLiveChatAccountSnapshot(args.service, args.row.requester_user_id)
      : Promise.resolve(undefined),
  ])

  const lookupSession = createCsAgentLookups(
    args.service,
    {
      caseId: args.row.id,
      requesterUserId: args.row.requester_user_id,
      requesterEmail: args.row.requester_email,
      linkedOrderId: args.row.order_id,
    },
    args.liveChatSession && args.liveChatActor
      ? { liveChatSession: args.liveChatSession, liveChatActor: args.liveChatActor }
      : undefined,
  )
  const generated = await generateCsAgentDraft({
    model: modelId,
    rootPrompt: args.rootPrompt,
    pack: {
      greetingName: args.greetingName,
      caseSubject: args.row.subject,
      caseKind: args.row.kind,
      caseStatus: args.row.status,
      sourceChannel: args.row.source_channel,
      requesterRole: args.row.requester_role,
      lastCustomerMessage,
      thread,
      liveChatTurns: liveChat.turns,
      liveChatUseOrderTools: args.row.source_channel === "live_chat"
        ? liveChatWriterNeedsTools(lastCustomerMessage)
        : undefined,
      order: args.order,
      priorTickets,
      help: args.knowledge.helpArticles,
      examples: args.knowledge.examples,
      macros: args.knowledge.macros,
      rewriteInstruction: args.rewriteInstruction,
      currentDraft: args.currentDraft,
      accountSnapshot,
      liveChatRegenerate: args.liveChatRegenerate,
    },
    lookups: lookupSession.lookups,
  })

  return {
    body: generated.reply,
    origin: "llm",
    slugs: generated.citedHelpSlugs,
    exampleIds,
    model: modelId,
    needsHumanReview: generated.needsHumanReview,
    closeTicket: generated.closeTicket,
    reason: generated.reason,
    citations: citationsFromAgent({
      orders: [args.order, ...(accountSnapshot?.orders ?? []), ...lookupSession.resolvedOrders()],
      orderRefs: generated.citedOrderRefs,
      tickets: priorTickets,
      ticketIds: generated.citedTicketIds,
    }),
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
): Promise<{ data: SupportReplyDraftView } | { pending: true } | { error: string }> {
  const parsed = supportReplyDraftCaseIdSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }

  if (parsed.data.peek === true && parsed.data.force !== true) {
    return peekReadyDraft(staff.service, parsed.data.case_id)
  }

  return generateAndStoreDraft(staff.service, parsed.data.case_id, parsed.data.force === true, {
    rewriteInstruction: parsed.data.rewrite_instruction,
    currentDraft: parsed.data.current_draft,
  })
}

async function matchingStoredDraft(
  service: SupabaseClient,
  row: SupportCaseRow,
  messages: SupportCaseMessageRow[],
  rootPrompt: string,
): Promise<SupportReplyDraftRow | null> {
  const fingerprint = supportReplyDraftFingerprint({
    promptVersion: SUPPORT_REPLY_PROMPT_VERSION,
    rootPrompt,
    caseId: row.id,
    subject: row.subject,
    status: row.status,
    lastCustomerMessage: lastCustomerText(row, messages),
    lastMessageAt: lastMessageAt(messages),
  })
  const existing = await getSupportReplyDraftByCaseId(service, row.id)
  if (existing && existing.source_fingerprint === fingerprint && existing.body.trim()) {
    return existing
  }
  return null
}

async function peekReadyDraft(
  service: SupabaseClient,
  caseId: string,
): Promise<{ data: SupportReplyDraftView } | { pending: true } | { error: string }> {
  const loaded = await loadCaseContext(service, caseId)
  if ("error" in loaded) return loaded
  const rootPrompt = await getSupportReplyRootPromptBody(service)
  const existing = await matchingStoredDraft(service, loaded.row, loaded.messages, rootPrompt)
  if (!existing) return { pending: true }
  return { data: toView(existing, true, false) }
}

export async function generateAndStoreDraft(
  service: SupabaseClient,
  caseId: string,
  force = false,
  rewrite?: {
    rewriteInstruction?: string
    currentDraft?: string
    liveChatSession?: LiveChatSessionRow
    liveChatActor?: LiveChatActionActor
    /** Jev-selected writer. Inbox drafts ignore this. */
    modelId?: string
    /** Latest visitor bubble — writer must answer this turn. */
    latestVisitorMessage?: string
    liveChatRegenerate?: {
      previousReply: string
      rating?: string
      note?: string | null
    }
  },
): Promise<{ data: SupportReplyDraftView; closeTicket: boolean } | { error: string }> {
  const loaded = await loadCaseContext(service, caseId)
  if ("error" in loaded) return loaded

  const { row, messages } = loaded
  const lastCustomer =
    rewrite?.latestVisitorMessage?.trim() || lastCustomerText(row, messages)
  const rootPrompt = await getSupportReplyRootPromptBody(service)
  const fingerprint = supportReplyDraftFingerprint({
    promptVersion: SUPPORT_REPLY_PROMPT_VERSION,
    rootPrompt,
    caseId: row.id,
    subject: row.subject,
    status: row.status,
    lastCustomerMessage: lastCustomer,
    lastMessageAt: lastMessageAt(messages),
  })

  if (!force) {
    const existing = await matchingStoredDraft(service, row, messages, rootPrompt)
    if (existing) {
      return { data: toView(existing, true, false), closeTicket: false }
    }
  }

  const query = supportReplyRetrievalQuery({
    lastCustomerMessage: lastCustomer,
    conversation: visibleSupportConversation(messages)
      .map((turn) => turn.body)
      .join("\n"),
    subject: row.subject,
  })
  const [knowledge, order, names] = await Promise.all([
    gatherSupportReplyKnowledge(service, {
      query,
      kind: row.kind,
      excludeCaseId: row.id,
      sourceChannel: row.source_channel,
      requesterUserId: row.requester_user_id,
      requesterEmail: row.requester_email,
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
    generated = await generateDraftBody({
      service,
      row,
      messages,
      knowledge,
      order,
      greetingName,
      rootPrompt,
      rewriteInstruction: force ? rewrite?.rewriteInstruction : undefined,
      currentDraft: force ? rewrite?.currentDraft : undefined,
      liveChatSession: rewrite?.liveChatSession,
      liveChatActor: rewrite?.liveChatActor,
      modelId: force ? rewrite?.modelId : undefined,
      latestVisitorMessage: rewrite?.latestVisitorMessage,
      liveChatRegenerate: rewrite?.liveChatRegenerate,
    })
  } catch (error) {
    console.error("[supportReplyDraft] generate failed:", error)
    if (row.source_channel === "live_chat") {
      return { error: "Live chat model did not return a grounded reply." }
    }
    const fallback = fallbackDraft(
      knowledge,
      draftMacroVars(greetingName, row.order_ref, order),
      lastCustomer,
    )
    generated = { ...fallback, model: null, needsHumanReview: true, closeTicket: false }
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
    reason: generated.reason,
    citations: generated.citations,
  })
  if (!saved) return { error: "Could not save the draft." }

  return {
    data: toView(saved, false, generated.needsHumanReview),
    closeTicket: generated.closeTicket === true,
  }
}

/**
 * Live-chat writer used when the thread has no support case (guest / no email).
 * Inbox drafts still require a case. This does not persist a draft row.
 */
export async function generateLiveChatReplyBody(
  service: SupabaseClient,
  args: {
    session: LiveChatSessionRow
    liveChatActor: LiveChatActionActor
    rewriteInstruction: string
    modelId: string
    latestVisitorMessage: string
    liveChatRegenerate?: {
      previousReply: string
      rating?: string
      note?: string | null
    }
  },
): Promise<{ body: string; closeTicket: boolean } | { error: string }> {
  const liveChat = await loadLiveChatWriterTurns(
    service,
    args.session.id,
    args.latestVisitorMessage,
  )
  const lastCustomerMessage =
    liveChat.lastCustomer || args.latestVisitorMessage.trim()
  if (!lastCustomerMessage) return { error: "No visitor message to answer." }

  const rootPrompt = args.rewriteInstruction.trim()
  const query = supportReplyRetrievalQuery({
    lastCustomerMessage,
    conversation: liveChat.turns.map((turn) => turn.body).join("\n"),
    subject: "Live chat",
  })
  const knowledge = await gatherSupportReplyKnowledge(service, {
    query,
    kind: null,
    excludeCaseId: args.session.support_case_id,
    sourceChannel: "live_chat",
    requesterUserId: args.session.user_id,
    requesterEmail: args.session.visitor_email,
  })

  if (!isLiveChatCsLlmEnabled()) {
    return {
      body: resolveLiveChatFallbackReply(lastCustomerMessage),
      closeTicket: false,
    }
  }

  const greetingName = supportReplyGreetingName({
    contactName: args.session.visitor_name,
    displayName: args.session.visitor_name,
    role: args.session.user_id ? "member" : "guest",
  })

  const [priorTickets, accountSnapshot] = await Promise.all([
    listPriorTicketsForCsAgent(service, {
      caseId: args.session.support_case_id,
      requesterUserId: args.session.user_id,
      requesterEmail: args.session.visitor_email,
      linkedOrderId: null,
    }),
    loadLiveChatAccountSnapshot(service, args.session.user_id),
  ])

  const lookupSession = createCsAgentLookups(
    service,
    {
      caseId: args.session.support_case_id,
      requesterUserId: args.session.user_id,
      requesterEmail: args.session.visitor_email,
      linkedOrderId: null,
    },
    { liveChatSession: args.session, liveChatActor: args.liveChatActor },
  )

  try {
    const generated = await generateCsAgentDraft({
      model: args.modelId.trim() || liveChatCsModelId(),
      rootPrompt,
      pack: {
        greetingName,
        caseSubject: "Live chat",
        caseKind: "general",
        caseStatus: "submitted",
        sourceChannel: "live_chat",
        requesterRole: args.session.user_id ? "member" : "guest",
        lastCustomerMessage,
        thread: liveChat.turns,
        liveChatTurns: liveChat.turns,
        liveChatUseOrderTools: liveChatWriterNeedsTools(lastCustomerMessage),
        order: null,
        priorTickets,
        help: knowledge.helpArticles,
        examples: knowledge.examples,
        macros: knowledge.macros,
        rewriteInstruction: rootPrompt,
        accountSnapshot,
        liveChatRegenerate: args.liveChatRegenerate,
      },
      lookups: lookupSession.lookups,
    })
    const body = generated.reply.trim()
    if (!body) return { error: "Live chat model did not return a grounded reply." }
    return { body, closeTicket: generated.closeTicket === true }
  } catch (error) {
    console.error("[supportReplyDraft] live chat generate failed:", error)
    return { error: "Live chat model did not return a grounded reply." }
  }
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
  caseId?: string | null
  sessionId?: string | null
  sentBody: string
  staffUserId: string | null
  sourceChannel?: string | null
  rating?: "very_good" | "okay" | "bad"
  ratingNote?: string | null
}): Promise<void> {
  try {
    const service = staffClient()
    if (!service) return
    const sent = args.sentBody.trim()
    if (!sent) return

    if (args.caseId) {
      const loaded = await loadCaseContext(service, args.caseId)
      if ("error" in loaded) return
      const draft = await getSupportReplyDraftByCaseId(service, loaded.row.id)
      const rating = args.rating ?? supportReplyRatingForSentBody(draft?.body, sent)
      await insertSupportReplyExample(service, {
        caseId: loaded.row.id,
        kind: loaded.row.kind,
        customerExcerpt: lastCustomerText(loaded.row, loaded.messages),
        staffReply: sent,
        citedHelpSlugs: draft?.cited_help_slugs ?? [],
        rating,
        draftId: draft?.id ?? null,
        ratedBy: args.staffUserId,
        sourceChannel: args.sourceChannel ?? loaded.row.source_channel ?? null,
        ratingNote: args.ratingNote ?? null,
      })
      return
    }

    if (!args.sessionId) return
    const messages = await listLiveChatMessagesForSession(service, args.sessionId)
    const customerExcerpt = latestLiveChatVisitorContent(messages)
    if (!customerExcerpt) return

    await insertSupportReplyExample(service, {
      caseId: null,
      kind: null,
      customerExcerpt,
      staffReply: sent,
      citedHelpSlugs: [],
      rating: args.rating ?? "okay",
      ratedBy: args.staffUserId,
      sourceChannel: args.sourceChannel ?? "live_chat",
      ratingNote: args.ratingNote ?? null,
    })
  } catch (error) {
    console.warn("[supportReplyDraft] learn-from-send skipped:", error)
  }
}

async function enqueueDetachedSupportReplyDraft(caseId: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim()
  const origin = supportReplyDraftWorkerOrigin()
  if (!secret || !origin) return false

  try {
    const url = new URL("/api/cron/support-reply-drafts", origin)
    url.searchParams.set("case_id", caseId)
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    })
    return response.ok || response.status === 202
  } catch (error) {
    console.warn(
      "[supportReplyDraft] detached enqueue failed:",
      error instanceof Error ? error.message : error,
    )
    return false
  }
}

async function generateInboundSupportReplyDraft(caseId: string): Promise<void> {
  const enqueued = await enqueueDetachedSupportReplyDraft(caseId)
  if (enqueued) return

  const service = staffClient()
  if (!service) return
  const result = await generateAndStoreDraft(service, caseId, false)
  if ("error" in result) {
    console.warn("[supportReplyDraft] inbound generate:", result.error)
  }
}

export function scheduleSupportReplyDraft(caseId: string): void {
  const id = caseId.trim()
  if (!id) return

  const run = async () => {
    try {
      await generateInboundSupportReplyDraft(id)
    } catch (error) {
      console.error(
        "[supportReplyDraft] inbound generate failed:",
        error instanceof Error ? error.message : error,
      )
    }
  }

  try {
    after(run)
  } catch {
    void run()
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
