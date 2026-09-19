import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertLiveChatMessage,
  listLiveChatMessagesForSession,
  mergeLiveChatSessionMetadata,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  LIVE_CHAT_PERSONA_JOINED_AT_KEY,
  LIVE_CHAT_PERSONA_METADATA_KEY,
  isLiveChatJoinMessage,
  liveChatHumanFeelDelay,
  liveChatAskNeedsLookup,
  liveChatHoldAfterGenerationMs,
  liveChatJoinMessage,
  liveChatPersonaAlreadyJoined,
  liveChatPersonaVoiceNote,
  resolveLiveChatPersona,
  type LiveChatPersona,
} from "@/lib/live-chat/human-feel"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"

export async function ensureLiveChatSessionPersona(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<{ persona: LiveChatPersona; session: LiveChatSessionRow }> {
  const persona = resolveLiveChatPersona(session.id, session.metadata)
  if (session.metadata[LIVE_CHAT_PERSONA_METADATA_KEY] === persona.id) {
    return { persona, session }
  }

  await mergeLiveChatSessionMetadata(svc, session, {
    [LIVE_CHAT_PERSONA_METADATA_KEY]: persona.id,
  })
  return {
    persona,
    session: {
      ...session,
      metadata: { ...session.metadata, [LIVE_CHAT_PERSONA_METADATA_KEY]: persona.id },
    },
  }
}

export function liveChatRewriteWithPersona(basePrompt: string, firstName: string): string {
  const voice = liveChatPersonaVoiceNote(firstName)
  if (basePrompt.includes(voice)) return basePrompt
  return `${basePrompt.trim()}\n\n${voice}`
}

export async function announceLiveChatPersonaJoin(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  persona: LiveChatPersona,
): Promise<{ joined: LiveChatMessageRow | null; session: LiveChatSessionRow }> {
  if (liveChatPersonaAlreadyJoined(session.metadata)) {
    return { joined: null, session }
  }

  const recent = await listLiveChatMessagesForSession(svc, session.id, { limit: 40 })
  if (recent.some((message) => isLiveChatJoinMessage(message.content))) {
    const marked = await markPersonaJoined(svc, session)
    return { joined: null, session: marked }
  }

  const joined = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "system",
    content: liveChatJoinMessage(persona.firstName),
  })
  const marked = await markPersonaJoined(svc, session)
  if (joined) {
    await broadcastLiveChatMessage({
      sessionId: session.id,
      message: {
        id: joined.id,
        session_id: session.id,
        sender_type: "system",
        sender_agent_id: null,
        content: joined.content,
        created_at: joined.created_at,
      },
    })
  }
  return { joined, session: marked }
}

export async function holdLiveChatHumanFeel(args: {
  sessionId: string
  visitorContent: string
  replyContent: string
  isFirstJoin: boolean
  startedAtMs: number
  sleep?: (ms: number) => Promise<void>
}): Promise<void> {
  const delay = liveChatHumanFeelDelay({
    sessionId: args.sessionId,
    visitorChars: args.visitorContent.length,
    replyChars: args.replyContent.length,
    isFirstJoin: args.isFirstJoin,
    needsLookup: liveChatAskNeedsLookup(args.visitorContent),
  })
  const waitMs = liveChatHoldAfterGenerationMs({
    elapsedMs: Date.now() - args.startedAtMs,
    targetMs: delay.totalMs,
  })
  if (waitMs <= 0) return
  const sleep = args.sleep ?? defaultSleep
  await sleep(waitMs)
}

export async function sleepUntilLiveChatJoin(args: {
  sessionId: string
  visitorContent: string
  isFirstJoin: boolean
  startedAtMs: number
  sleep?: (ms: number) => Promise<void>
}): Promise<void> {
  if (!args.isFirstJoin) return
  const delay = liveChatHumanFeelDelay({
    sessionId: args.sessionId,
    visitorChars: args.visitorContent.length,
    replyChars: 80,
    isFirstJoin: true,
    needsLookup: liveChatAskNeedsLookup(args.visitorContent),
  })
  const waitMs = liveChatHoldAfterGenerationMs({
    elapsedMs: Date.now() - args.startedAtMs,
    targetMs: delay.readMs + delay.walkOverMs,
  })
  if (waitMs <= 0) return
  const sleep = args.sleep ?? defaultSleep
  await sleep(waitMs)
}

async function markPersonaJoined(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<LiveChatSessionRow> {
  const joinedAt = new Date().toISOString()
  await mergeLiveChatSessionMetadata(svc, session, {
    [LIVE_CHAT_PERSONA_JOINED_AT_KEY]: joinedAt,
  })
  return {
    ...session,
    metadata: { ...session.metadata, [LIVE_CHAT_PERSONA_JOINED_AT_KEY]: joinedAt },
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
