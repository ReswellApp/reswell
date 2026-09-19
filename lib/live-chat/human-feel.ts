/**
 * Pure human-feel math for live chat: persona, join copy, and delay.
 * No I/O — safe for node:test without path aliases.
 */

export const LIVE_CHAT_PERSONA_IDS = ["hayden", "david"] as const
export type LiveChatPersonaId = (typeof LIVE_CHAT_PERSONA_IDS)[number]

export type LiveChatPersona = {
  id: LiveChatPersonaId
  firstName: string
  fullName: string
  imageUrl: string
  initials: string
}

export const LIVE_CHAT_PERSONAS: Record<LiveChatPersonaId, LiveChatPersona> = {
  hayden: {
    id: "hayden",
    firstName: "Hayden",
    fullName: "Hayden Garfield",
    imageUrl: "/images/about/hayden-garfield.png",
    initials: "HG",
  },
  david: {
    id: "david",
    firstName: "David",
    fullName: "David Kalt",
    imageUrl: "/images/about/david-kalt.png",
    initials: "DK",
  },
}

export const LIVE_CHAT_PERSONA_METADATA_KEY = "persona"
export const LIVE_CHAT_PERSONA_JOINED_AT_KEY = "persona_joined_at"

/** After generation is ready, never hold longer than this. */
export const LIVE_CHAT_HUMAN_FEEL_HOLD_CAP_MS = 12_000

export function liveChatJoinMessage(firstName: string): string {
  return `${firstName} joined the chat`
}

export function isLiveChatJoinMessage(content: string): boolean {
  return /^(Hayden|David) joined the chat$/.test(content.trim())
}

export function parseLiveChatPersonaId(value: unknown): LiveChatPersonaId | null {
  if (value === "hayden" || value === "david") return value
  return null
}

export function readLiveChatPersonaFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): LiveChatPersona | null {
  const id = parseLiveChatPersonaId(metadata?.[LIVE_CHAT_PERSONA_METADATA_KEY])
  return id ? LIVE_CHAT_PERSONAS[id] : null
}

export function liveChatPersonaAlreadyJoined(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const joinedAt = metadata?.[LIVE_CHAT_PERSONA_JOINED_AT_KEY]
  return typeof joinedAt === "string" && joinedAt.trim().length > 0
}

/** Stable ~70% Hayden / ~30% David from the session id. */
export function pickLiveChatPersonaId(sessionId: string): LiveChatPersonaId {
  return fnvHash(sessionId) % 10 < 7 ? "hayden" : "david"
}

export function pickLiveChatPersona(sessionId: string): LiveChatPersona {
  return LIVE_CHAT_PERSONAS[pickLiveChatPersonaId(sessionId)]
}

export function resolveLiveChatPersona(
  sessionId: string,
  metadata: Record<string, unknown> | null | undefined,
): LiveChatPersona {
  return readLiveChatPersonaFromMetadata(metadata) ?? pickLiveChatPersona(sessionId)
}

const LOOKUP_RE =
  /\b(order|tracking|payout|refund|label|sale|purchase|ship(?:ping|ment)?|where(?:'s| is))\b/i

export function liveChatAskNeedsLookup(visitorMessage: string): boolean {
  return LOOKUP_RE.test(visitorMessage)
}

export type LiveChatHumanFeelDelay = {
  readMs: number
  thinkMs: number
  typeMs: number
  walkOverMs: number
  totalMs: number
}

export function liveChatHumanFeelDelay(args: {
  sessionId: string
  visitorChars: number
  replyChars: number
  isFirstJoin: boolean
  needsLookup: boolean
}): LiveChatHumanFeelDelay {
  const readBase = clamp(400 + 18 * args.visitorChars, 500, 1800)
  const thinkBase = clamp(
    700 + (args.needsLookup ? 400 : 0) + (args.visitorChars > 160 ? 200 : 0),
    600,
    2200,
  )
  const typeBase = clamp(Math.round((args.replyChars / 18) * 1000), 900, 4500)
  const walkBase = args.isFirstJoin ? 850 : 0

  const readMs = jitter(readBase, args.sessionId, "read")
  const thinkMs = jitter(thinkBase, args.sessionId, "think")
  const typeMs = jitter(typeBase, args.sessionId, "type")
  const walkOverMs = walkBase === 0 ? 0 : clamp(jitter(walkBase, args.sessionId, "walk"), 600, 1100)

  return {
    readMs,
    thinkMs,
    typeMs,
    walkOverMs,
    totalMs: readMs + thinkMs + typeMs + walkOverMs,
  }
}

/** Remaining hold after the model finished, capped so a late generate does not add another full type delay. */
export function liveChatHoldAfterGenerationMs(args: {
  elapsedMs: number
  targetMs: number
  capMs?: number
}): number {
  const leftover = Math.max(0, args.targetMs - args.elapsedMs)
  return Math.min(leftover, args.capMs ?? LIVE_CHAT_HUMAN_FEEL_HOLD_CAP_MS)
}

export function liveChatPersonaVoiceNote(firstName: string): string {
  return `You are ${firstName} in this chat. Write as yourself in first person ("I"). Never say you are an AI, a bot, Reswell Team, or Reswell Bot. Short, like a DM: 1–3 sentences for most asks, one next step, no greeting stack.`
}

export function liveChatTypingLabel(firstName: string): string {
  return `${firstName} is typing…`
}

/** Hide optimistic thinking until Hayden/David's join line is in the thread. */
export function shouldShowLiveChatTeamTyping(args: {
  messages: Array<{ sender_type: string; content: string }>
  teamThinking: boolean
  typingName: string | null
  requireJoinBeforeTyping?: boolean
}): boolean {
  const hasJoin = args.messages.some((message) => isLiveChatJoinMessage(message.content))
  const hasTeamReply = args.messages.some(
    (message) => message.sender_type === "agent" || message.sender_type === "bot",
  )
  if (args.requireJoinBeforeTyping && !hasJoin && !hasTeamReply) {
    return false
  }
  return args.teamThinking || Boolean(args.typingName)
}

export function liveChatPersonaTeamMember(persona: LiveChatPersona): {
  id: string
  name: string
  imageUrl: string
  initials: string
} {
  return {
    id: persona.id === "hayden" ? "hayden-garfield" : "david-kalt",
    name: persona.fullName,
    imageUrl: persona.imageUrl,
    initials: persona.initials,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Deterministic ±15% so the same session feels consistent and tests can pin values. */
function jitter(base: number, sessionId: string, salt: string): number {
  const factor = 0.85 + ((fnvHash(`${sessionId}:${salt}`) % 1000) / 1000) * 0.3
  return Math.round(base * factor)
}

function fnvHash(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
