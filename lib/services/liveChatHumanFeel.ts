import type { SupabaseClient } from "@supabase/supabase-js"
import {
  claimLiveChatPersonaJoin,
  insertLiveChatMessage,
  listLiveChatMessagesForSession,
  mergeLiveChatSessionMetadata,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  LIVE_CHAT_PERSONA_METADATA_KEY,
  isLiveChatJoinMessage,
  liveChatHumanFeelDelay,
  liveChatAskNeedsLookup,
  liveChatHoldAfterGenerationMs,
  liveChatJoinMessage,
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
  const claim = await claimLiveChatPersonaJoin(svc, session.id)
  if (claim.status !== "claimed") {
    return {
      joined: null,
      session: claim.status === "already_joined" ? claim.session : session,
    }
  }

  const working = claim.session
  const recent = await listLiveChatMessagesForSession(svc, working.id, { limit: 40 })
  if (recent.some((message) => isLiveChatJoinMessage(message.content))) {
    return { joined: null, session: working }
  }

  const joined = await insertLiveChatMessage(svc, {
    session_id: working.id,
    sender_type: "system",
    content: liveChatJoinMessage(persona.firstName),
  })
  if (joined) {
    await broadcastLiveChatMessage({
      sessionId: working.id,
      message: {
        id: joined.id,
        session_id: working.id,
        sender_type: "system",
        sender_agent_id: null,
        content: joined.content,
        created_at: joined.created_at,
      },
    })
  }
  return { joined, session: working }
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
