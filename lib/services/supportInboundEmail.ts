import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchResendReceivedEmail } from "@/lib/inbound-email/resend-receiving"
import {
  getSupportCaseByCaseNumber,
  getSupportCaseMessageByInboundEmailId,
  insertSupportCaseEvent,
  insertSupportCaseMessage,
  listSupportCasesByRequesterEmail,
  resolveSupportCaseByAnyId,
  touchSupportCaseAfterMessage,
  updateSupportCaseAdmin,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { updateContactMessageRow } from "@/lib/db/contactMessages"
import { updateOrderSupportRequestAdmin } from "@/lib/db/order-support"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import type { NormalizedInboundEmail } from "@/lib/validations/inbound-email-webhook"
import {
  collectSupportInboundCaseHints,
  extractEmailAddress,
  inboundEmailPlainBody,
  inboundEmailsMatch,
  isAutomatedInboundEmail,
  isReswellTransactionalSender,
  normalizeEmailForMatch,
} from "@/lib/utils/support-inbound-email"

const BODY_MAX = 12000

export type ApplyInboundSupportEmailResult =
  | {
      ok: true
      status: "appended" | "duplicate" | "ignored"
      caseId?: string
      reason?: string
    }
  | { ok: false; error: string; retryable?: boolean }

function caseStatusToContact(status: SupportCaseStatus) {
  switch (status) {
    case "in_review":
      return "triaged" as const
    case "in_progress":
    case "waiting_on_you":
      return "ticket_created" as const
    case "resolved":
      return "resolved" as const
    case "submitted":
    default:
      return "new" as const
  }
}

function caseStatusToOrder(status: SupportCaseStatus) {
  switch (status) {
    case "in_review":
      return "triaged" as const
    case "waiting_on_you":
      return "waiting_on_customer" as const
    case "in_progress":
      return "investigating" as const
    case "resolved":
      return "resolved" as const
    case "submitted":
    default:
      return "new" as const
  }
}

function nextStatusAfterCustomerReply(status: SupportCaseStatus): SupportCaseStatus | undefined {
  if (status === "waiting_on_you" || status === "resolved") return "in_progress"
  return undefined
}

async function requesterEmailForCase(
  supabase: ReturnType<typeof createServiceRoleClient>,
  row: SupportCaseRow,
): Promise<string | null> {
  if (row.requester_email?.trim()) return row.requester_email.trim()
  if (!row.requester_user_id) return null
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", row.requester_user_id)
    .maybeSingle()
  const email = data && typeof data.email === "string" ? data.email.trim() : ""
  return email || null
}

async function caseAllowsSender(
  supabase: ReturnType<typeof createServiceRoleClient>,
  row: SupportCaseRow,
  from: string,
): Promise<boolean> {
  const stored = await requesterEmailForCase(supabase, row)
  if (!stored) return false
  return inboundEmailsMatch(from, stored)
}

async function resolveInboundCase(
  supabase: ReturnType<typeof createServiceRoleClient>,
  email: NormalizedInboundEmail,
): Promise<SupportCaseRow | null> {
  const hints = collectSupportInboundCaseHints({
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })

  for (const caseId of hints.caseIds) {
    const row = await resolveSupportCaseByAnyId(supabase, caseId)
    if (row && (await caseAllowsSender(supabase, row, email.from))) return row
  }

  for (const caseRef of hints.caseRefs) {
    const row = await getSupportCaseByCaseNumber(supabase, caseRef)
    if (row && (await caseAllowsSender(supabase, row, email.from))) return row
  }

  const fromEmail = extractEmailAddress(email.from)
  const matchEmail = normalizeEmailForMatch(email.from)
  if (!fromEmail || !matchEmail) return null

  const candidates = [
    ...(await listSupportCasesByRequesterEmail(supabase, fromEmail, { openOnly: true, limit: 8 })),
    ...(matchEmail !== fromEmail
      ? await listSupportCasesByRequesterEmail(supabase, matchEmail, { openOnly: true, limit: 8 })
      : []),
  ]

  const allowed: SupportCaseRow[] = []
  const seen = new Set<string>()
  for (const row of candidates) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    if (await caseAllowsSender(supabase, row, email.from)) allowed.push(row)
  }

  return allowed.length === 1 ? allowed[0] ?? null : null
}

async function dualWriteLegacyStatus(
  supabase: ReturnType<typeof createServiceRoleClient>,
  row: SupportCaseRow,
  status: SupportCaseStatus,
): Promise<void> {
  if (row.contact_message_id) {
    await updateContactMessageRow(supabase, {
      id: row.contact_message_id,
      support_status: caseStatusToContact(status),
    })
  }
  if (row.order_support_request_id) {
    await updateOrderSupportRequestAdmin(supabase, {
      id: row.order_support_request_id,
      support_status: caseStatusToOrder(status),
    })
  }
}

export async function hydrateInboundEmailFromResend(
  email: NormalizedInboundEmail,
): Promise<NormalizedInboundEmail | { error: string; retryable: boolean }> {
  if (!email.needsResendFetch) return email
  const fetched = await fetchResendReceivedEmail(email.inboundEmailId)
  if ("error" in fetched) {
    return { error: fetched.error, retryable: true }
  }
  return {
    ...email,
    from: fetched.from || email.from,
    to: fetched.to.length > 0 ? fetched.to : email.to,
    subject: fetched.subject || email.subject,
    text: fetched.text,
    html: fetched.html,
    headers: Object.keys(fetched.headers).length > 0 ? fetched.headers : email.headers,
    messageId: fetched.messageId ?? email.messageId,
    needsResendFetch: false,
  }
}

/**
 * Append a verified inbound customer email to the matching support case thread.
 */
export async function applyInboundSupportEmail(
  email: NormalizedInboundEmail,
): Promise<ApplyInboundSupportEmailResult> {
  const inboundMailbox = process.env.SUPPORT_INBOUND_REPLY_TO?.trim() || null

  if (isAutomatedInboundEmail(email)) {
    return { ok: true, status: "ignored", reason: "automated" }
  }
  if (isReswellTransactionalSender(email.from, inboundMailbox)) {
    return { ok: true, status: "ignored", reason: "transactional_sender" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Service role is not configured", retryable: true }
  }

  const existing = await getSupportCaseMessageByInboundEmailId(supabase, email.inboundEmailId)
  if (existing) {
    return { ok: true, status: "duplicate", caseId: existing.case_id }
  }

  const row = await resolveInboundCase(supabase, email)
  if (!row) {
    console.info("[inbound-email] no matching support case", {
      inboundEmailId: email.inboundEmailId,
    })
    return { ok: true, status: "ignored", reason: "unmatched" }
  }

  const body = inboundEmailPlainBody(email).slice(0, BODY_MAX).trim()
  if (!body) {
    return { ok: true, status: "ignored", caseId: row.id, reason: "empty_body" }
  }

  const posted = await insertSupportCaseMessage(supabase, {
    case_id: row.id,
    author_user_id: row.requester_user_id,
    author_role: "customer",
    body,
    inbound_email_id: email.inboundEmailId,
  })
  if (posted.duplicate) {
    return { ok: true, status: "duplicate", caseId: row.id }
  }
  if (posted.error) {
    return { ok: false, error: "Could not store the inbound message", retryable: true }
  }

  const nextStatus = nextStatusAfterCustomerReply(row.status)
  if (nextStatus) {
    const updated = await updateSupportCaseAdmin(supabase, { id: row.id, status: nextStatus })
    if (updated.error) {
      console.warn("[inbound-email] status update skipped:", updated.error.message)
    }
    await dualWriteLegacyStatus(supabase, row, nextStatus)
  }

  await touchSupportCaseAfterMessage(supabase, {
    id: row.id,
    preview: body,
    status: nextStatus,
  })

  await insertSupportCaseEvent(supabase, {
    case_id: row.id,
    event_type: "inbound_email",
    payload: {
      inbound_email_id: email.inboundEmailId,
      message_id: email.messageId,
      subject: email.subject.slice(0, 200),
      reopened: row.status === "resolved",
    },
  })

  if (nextStatus && nextStatus !== row.status) {
    await insertSupportCaseEvent(supabase, {
      case_id: row.id,
      event_type: row.status === "resolved" ? "reopened" : "status_changed",
      payload: { status: nextStatus, source: "inbound_email" },
    })
  }

  return { ok: true, status: "appended", caseId: row.id }
}
