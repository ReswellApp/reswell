import { after } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getAgentDisplayNamesByIds,
  listRecentOpenLiveChatSessionsForUser,
  listRecentOpenLiveChatSessionsForVisitorToken,
  getLiveChatSessionForVisitor,
  getVisitorDisplayNamesByIds,
  insertLiveChatMessage,
  insertLiveChatSession,
  listLiveChatMessagesForSession,
  updateLiveChatSessionRow,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { createLiveChatSessionSchema, sendLiveChatVisitorMessageSchema } from "@/lib/validations/liveChat"
import { COMPOSER_UNLOCK_DENIED_ERROR } from "@/lib/messages/composer-unlock-errors"
import { verifyLiveChatComposerUnlock } from "@/lib/services/composerUnlock"
import { generateLiveChatPublicId } from "@/lib/utils/live-chat-public-id"
import {
  LIVE_CHAT_SESSION_CLOSED_CODE,
  LIVE_CHAT_SESSION_CLOSED_MESSAGE,
  LIVE_CHAT_SESSION_MISSING_CODE,
  LIVE_CHAT_SESSION_MISSING_MESSAGE,
} from "@/lib/live-chat/errors"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import { autoSendLiveChatCsAgentReply } from "@/lib/services/liveChatCsAgentAutoReply"
import { resolveLiveChatPersona } from "@/lib/live-chat/human-feel"
import { isLegacyLiveChatWidgetCopy, liveChatAgentDisplayName } from "@/lib/live-chat/team-display"
import { ensureLiveChatSessionPersona } from "@/lib/services/liveChatHumanFeel"
import { assertLiveChatVisitorAccess } from "@/lib/services/liveChatVisitorAccess"
import { openLiveChatSupportCase, syncLiveChatVisitorMessageToCase } from "@/lib/services/liveChatSupportCase"
import {
  closeOpenLiveChatConversationsForVisitor,
  LIVE_CHAT_STALE_SYSTEM_MESSAGE,
  resolveLiveChatConversation,
} from "@/lib/services/liveChatClose"
import {
  liveChatSessionActivityAt,
  shouldResumeLiveChatSession,
} from "@/lib/live-chat/session-expiry"

function isPlaceholderVisitorName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  return trimmed.length === 0 || trimmed.toLowerCase() === "guest"
}

async function resolveSignedInVisitorName(
  svc: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const names = await getVisitorDisplayNamesByIds(svc, [userId])
  return names.get(userId) ?? null
}

async function attachSignedInVisitorIdentity(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  user: { id: string; email?: string | null } | null,
): Promise<LiveChatSessionRow> {
  if (!user?.id) return session

  const patch: {
    user_id?: string
    visitor_name?: string
    visitor_email?: string | null
  } = {}

  if (!session.user_id) patch.user_id = user.id
  if (isPlaceholderVisitorName(session.visitor_name)) {
    const name = await resolveSignedInVisitorName(svc, user.id)
    if (name) patch.visitor_name = name
  }
  const email = user.email?.trim()
  if (email && !session.visitor_email) patch.visitor_email = email

  if (Object.keys(patch).length === 0) return session
  await updateLiveChatSessionRow(svc, session.id, patch)
  return { ...session, ...patch }
}

function toVisitorSession(session: LiveChatSessionRow) {
  const persona = resolveLiveChatPersona(session.id, session.metadata)
  return {
    id: session.id,
    public_id: session.public_id,
    visitor_name: session.visitor_name,
    status: session.status,
    support_case_id: session.support_case_id,
    assigned_agent_id: session.assigned_agent_id,
    persona: persona.id,
    persona_first_name: persona.firstName,
  }
}

async function linkSupportCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  initialVisitorMessage?: string,
): Promise<LiveChatSessionRow> {
  const opened = await openLiveChatSupportCase(svc, session, {
    initialVisitorMessage,
  })
  if (!opened) return session
  return {
    ...session,
    support_case_id: opened.supportCaseId,
    contact_message_id: opened.contactMessageId || session.contact_message_id,
  }
}

function isResumableVisitorSession(session: LiveChatSessionRow): boolean {
  return shouldResumeLiveChatSession({
    status: session.status,
    lastActivityAt: liveChatSessionActivityAt(session),
  })
}

async function expireStaleVisitorSession(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<void> {
  if (session.status === "resolved" || session.status === "closed") return
  await resolveLiveChatConversation(svc, session, {
    note: LIVE_CHAT_STALE_SYSTEM_MESSAGE,
  })
}

async function pickResumableVisitorSession(
  svc: SupabaseClient,
  rows: LiveChatSessionRow[],
): Promise<LiveChatSessionRow | null> {
  let chosen: LiveChatSessionRow | null = null
  for (const row of rows) {
    if (isResumableVisitorSession(row)) {
      if (!chosen) chosen = row
      continue
    }
    await expireStaleVisitorSession(svc, row)
  }
  return chosen
}

async function findOpenSessionForVisitor(
  svc: SupabaseClient,
  args: {
    userId?: string | null
    visitorToken: string
    prefer: "ai" | "human" | "any"
  },
): Promise<LiveChatSessionRow | null> {
  if (args.userId) {
    const recentForUser = await listRecentOpenLiveChatSessionsForUser(svc, args.userId, 20)
    const match = await pickResumableVisitorSession(
      svc,
      recentForUser.filter((row) => sessionMatchesPrefer(row, args.prefer)),
    )
    if (match) return match
  }
  const recentForToken = await listRecentOpenLiveChatSessionsForVisitorToken(
    svc,
    args.visitorToken,
    20,
  )
  return pickResumableVisitorSession(
    svc,
    recentForToken.filter((row) => {
      // Never let a guest (or different member) inherit another member's open chat —
      // that reused tickets and admin replies from the wrong person.
      if (row.user_id && row.user_id !== (args.userId ?? null)) return false
      if (args.userId && row.user_id && row.user_id !== args.userId) return false
      return sessionMatchesPrefer(row, args.prefer)
    }),
  )
}

async function startFreshVisitorSession(
  svc: SupabaseClient,
  args: {
    visitorToken: string
    visitorName: string
    user: { id: string; email?: string | null } | null
  },
): Promise<LiveChatSessionRow | null> {
  const session = await insertLiveChatSession(svc, {
    public_id: generateLiveChatPublicId(),
    visitor_token: args.visitorToken,
    user_id: args.user?.id ?? null,
    visitor_name: args.visitorName,
    visitor_email: args.user?.email?.trim() || null,
  })
  if (!session) return null

  const ensured = await ensureLiveChatSessionPersona(svc, session)
  return ensured.session
}

export type LiveChatVisitorMessage = LiveChatMessageRow & {
  agent_display_name: string | null
}

/** Attach real agent names so the widget shows who replied, not just "Support". */
async function enrichMessagesWithAgentNames(
  svc: SupabaseClient,
  messages: LiveChatMessageRow[],
  session?: LiveChatSessionRow,
): Promise<LiveChatVisitorMessage[]> {
  const agentIds = messages
    .filter((m) => m.sender_type === "agent" && m.sender_agent_id)
    .map((m) => m.sender_agent_id as string)
  const names = await getAgentDisplayNamesByIds(svc, agentIds)
  const personaFirstName = session
    ? resolveLiveChatPersona(session.id, session.metadata).firstName
    : null
  return messages
    .filter((m) => !isLegacyLiveChatWidgetCopy(m.content))
    .map((m) => ({
      ...m,
      agent_display_name: liveChatAgentDisplayName({
        senderType: m.sender_type,
        senderAgentId: m.sender_agent_id,
        lookedUpName: m.sender_agent_id ? names.get(m.sender_agent_id) : null,
        personaFirstName,
      }),
    }))
}

/** AI-only threads have no case/ticket and have not asked for a human. */
function isAiOnlyThread(session: LiveChatSessionRow): boolean {
  return (
    session.metadata.ai_mode === "active" &&
    session.metadata.ai_handoff_requested !== true &&
    !session.support_case_id &&
    !session.contact_message_id
  )
}

function sessionMatchesPrefer(
  session: LiveChatSessionRow,
  prefer: "ai" | "human" | "any",
): boolean {
  if (prefer === "ai") return isAiOnlyThread(session)
  if (prefer === "human") return !isAiOnlyThread(session)
  return true
}

/** Widget resume only needs recent context — not the full case archive. */
const VISITOR_RESUME_MESSAGE_LIMIT = 80

async function visitorResumePayload(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<{
  success: true
  session: ReturnType<typeof toVisitorSession>
  messages: LiveChatVisitorMessage[]
}> {
  const messages = await enrichMessagesWithAgentNames(
    svc,
    await listLiveChatMessagesForSession(svc, session.id, {
      limit: VISITOR_RESUME_MESSAGE_LIMIT,
    }),
    session,
  )
  return {
    success: true,
    session: toVisitorSession(session),
    messages,
  }
}

export async function createOrResumeLiveChatSessionService(raw: unknown): Promise<
  | {
      success: true
      session: ReturnType<typeof toVisitorSession>
      messages: LiveChatVisitorMessage[]
    }
  | { error: string; status?: number }
> {
  const access = await assertLiveChatVisitorAccess()
  if (!access.ok) return { error: access.error, status: access.status }

  const parsed = createLiveChatSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid session request" }
  }

  const svc = createServiceRoleClient()

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  const signedInName = user?.id ? await resolveSignedInVisitorName(svc, user.id) : null
  const clientName = parsed.data.visitor_name?.trim() || ""
  const visitorName =
    signedInName ||
    (!isPlaceholderVisitorName(clientName) ? clientName : "") ||
    "Guest"

  const forceNew = parsed.data.force_new === true
  const prefer = parsed.data.prefer ?? "any"

  if (forceNew) {
    // Solved path: resolve linked tickets, then close chats — only then mint a fresh thread.
    await closeOpenLiveChatConversationsForVisitor(svc, {
      userId: user?.id ?? null,
      visitorToken: parsed.data.visitor_token,
    })
  }

  if (!forceNew && parsed.data.resume_public_id) {
    const existing = await getLiveChatSessionForVisitor(
      svc,
      parsed.data.resume_public_id,
      parsed.data.visitor_token,
    )
    // Resolved/closed chats stay in history; the visitor gets a fresh conversation.
    // Member-linked threads must not resume for anonymous visitors (or a different user)
    // even if localStorage still has the public id after sign-out.
    const canResumeAsCurrentVisitor =
      existing &&
      isResumableVisitorSession(existing) &&
      (!existing.user_id || existing.user_id === user?.id) &&
      sessionMatchesPrefer(existing, prefer)
    if (canResumeAsCurrentVisitor && existing) {
      const attached = await attachSignedInVisitorIdentity(svc, existing, user)
      return visitorResumePayload(svc, attached)
    }
    if (
      existing &&
      (existing.status === "open" || existing.status === "assigned") &&
      !isResumableVisitorSession(existing)
    ) {
      await expireStaleVisitorSession(svc, existing)
    }
  }

  // Resume the latest open chat for this member (cross-device) or visitor
  // token (same browser). Opening/closing the widget must not mint a new
  // session — only force_new / "Start new conversation" does.
  // "Talk to AI" (prefer=ai) must not snap into an open human/case thread.
  if (!forceNew) {
    const existingOpen = await findOpenSessionForVisitor(svc, {
      userId: user?.id ?? null,
      visitorToken: parsed.data.visitor_token,
      prefer,
    })
    if (existingOpen) {
      if (existingOpen.visitor_token !== parsed.data.visitor_token) {
        await updateLiveChatSessionRow(svc, existingOpen.id, {
          visitor_token: parsed.data.visitor_token,
        })
      }
      const attached = await attachSignedInVisitorIdentity(
        svc,
        {
          ...existingOpen,
          visitor_token: parsed.data.visitor_token,
        },
        user,
      )
      return visitorResumePayload(svc, attached)
    }
  }

  const session = await startFreshVisitorSession(svc, {
    visitorToken: parsed.data.visitor_token,
    visitorName,
    user,
  })

  if (!session) {
    return { error: "Could not start chat. Try again in a moment." }
  }

  // Soft-open happens on first visitor message — never on widget open/greeting.
  return visitorResumePayload(svc, session)
}

export async function sendLiveChatVisitorMessageService(
  publicId: string,
  raw: unknown,
): Promise<
  | {
      success: true
      message: LiveChatMessageRow
      session_id: string
      public_id: string
      started_fresh: boolean
      support_case_id: string | null
    }
  | { error: string; code?: string; status?: number }
> {
  const access = await assertLiveChatVisitorAccess()
  if (!access.ok) return { error: access.error, status: access.status }

  const parsed = sendLiveChatVisitorMessageSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid message"
    return { error: msg }
  }

  if (
    !verifyLiveChatComposerUnlock(
      parsed.data.composer_unlock_token,
      parsed.data.visitor_token,
      publicId,
    )
  ) {
    return { error: COMPOSER_UNLOCK_DENIED_ERROR, status: 403 }
  }

  const svc = createServiceRoleClient()
  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  let startedFresh = false
  let session = await getLiveChatSessionForVisitor(svc, publicId, parsed.data.visitor_token)
  if (session && !isResumableVisitorSession(session)) {
    if (session.status === "open" || session.status === "assigned") {
      await expireStaleVisitorSession(svc, session)
    }
    session = null
    startedFresh = true
  }
  if (!session) {
    // Prefer adopting an existing open thread over minting a parallel session/case.
    const existingOpen = await findOpenSessionForVisitor(svc, {
      userId: user?.id ?? null,
      visitorToken: parsed.data.visitor_token,
      prefer: "any",
    })
    if (existingOpen) {
      if (existingOpen.visitor_token !== parsed.data.visitor_token) {
        await updateLiveChatSessionRow(svc, existingOpen.id, {
          visitor_token: parsed.data.visitor_token,
        })
      }
      session = {
        ...existingOpen,
        visitor_token: parsed.data.visitor_token,
      }
      startedFresh = existingOpen.public_id !== publicId
    } else {
      const signedInName = user?.id ? await resolveSignedInVisitorName(svc, user.id) : null
      const clientName = parsed.data.visitor_name?.trim() || ""
      const visitorName =
        signedInName ||
        (!isPlaceholderVisitorName(clientName) ? clientName : "") ||
        "Guest"
      session = await startFreshVisitorSession(svc, {
        visitorToken: parsed.data.visitor_token,
        visitorName,
        user,
      })
      if (!session) {
        return {
          error: LIVE_CHAT_SESSION_MISSING_MESSAGE,
          code: LIVE_CHAT_SESSION_MISSING_CODE,
          status: 404,
        }
      }
      startedFresh = true
    }
  }
  if (session.status === "closed" || session.status === "resolved") {
    return { error: LIVE_CHAT_SESSION_CLOSED_MESSAGE, code: LIVE_CHAT_SESSION_CLOSED_CODE }
  }

  session = await attachSignedInVisitorIdentity(svc, session, user)

  const clientName = parsed.data.visitor_name?.trim() || ""
  if (
    !user &&
    !isPlaceholderVisitorName(clientName) &&
    clientName !== session.visitor_name
  ) {
    await updateLiveChatSessionRow(svc, session.id, { visitor_name: clientName })
    session = { ...session, visitor_name: clientName }
  }

  if (parsed.data.visitor_email && parsed.data.visitor_email !== session.visitor_email) {
    await updateLiveChatSessionRow(svc, session.id, {
      visitor_email: parsed.data.visitor_email,
    })
    session = { ...session, visitor_email: parsed.data.visitor_email }
  }

  const message = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "visitor",
    content: parsed.data.content,
  })

  if (!message) {
    return { error: "Could not send message. Try again." }
  }

  session = await linkSupportCase(svc, session, message.content)
  const supportCaseId = session.support_case_id

  // Mirror the visitor turn into the case transcript (deduped if already inserted on soft-open).
  session = await syncLiveChatVisitorMessageToCase(svc, session, message.content)

  after(async () => {
    await broadcastLiveChatMessage({
      sessionId: session.id,
      message: {
        id: message.id,
        session_id: session.id,
        sender_type: "visitor",
        sender_agent_id: null,
        content: message.content,
        created_at: message.created_at,
      },
    })
    await autoSendLiveChatCsAgentReply(
      svc,
      { ...session, support_case_id: supportCaseId ?? session.support_case_id },
      message,
    )
  })

  return {
    success: true,
    message,
    session_id: session.id,
    public_id: session.public_id,
    started_fresh: startedFresh,
    support_case_id: session.support_case_id ?? supportCaseId,
  }
}

export async function getLiveChatVisitorThreadService(
  publicId: string,
  visitorToken: string,
): Promise<
  | {
      success: true
      session: ReturnType<typeof toVisitorSession>
      messages: LiveChatVisitorMessage[]
    }
  | { error: string; code?: string; status?: number }
> {
  const access = await assertLiveChatVisitorAccess()
  if (!access.ok) return { error: access.error, status: access.status }

  const svc = createServiceRoleClient()
  const session = await getLiveChatSessionForVisitor(svc, publicId, visitorToken)
  if (!session) {
    return {
      error: LIVE_CHAT_SESSION_MISSING_MESSAGE,
      code: LIVE_CHAT_SESSION_MISSING_CODE,
      status: 404,
    }
  }

  const messages = await enrichMessagesWithAgentNames(
    svc,
    await listLiveChatMessagesForSession(svc, session.id, {
      limit: VISITOR_RESUME_MESSAGE_LIMIT,
    }),
    session,
  )
  return {
    success: true,
    session: toVisitorSession(session),
    messages,
  }
}

export async function validateLiveChatSessionAccess(
  publicId: string,
  visitorToken: string,
): Promise<LiveChatSessionRow | null> {
  const svc = createServiceRoleClient()
  return getLiveChatSessionForVisitor(svc, publicId, visitorToken)
}
