import {
  LIVE_CHAT_PERSONAS,
  isLiveChatJoinMessage,
  liveChatPersonaTeamMember,
} from "./human-feel.ts"

type SupportFace = {
  id: string
  name: string
  imageUrl: string
  initials: string
}

/** Default support face shown before API data loads (Hayden Garfield). */
export const LIVE_CHAT_SUPPORT_LEAD_FALLBACK: SupportFace =
  liveChatPersonaTeamMember(LIVE_CHAT_PERSONAS.hayden)

export const LIVE_CHAT_SUPPORT_DAVID_FALLBACK: SupportFace =
  liveChatPersonaTeamMember(LIVE_CHAT_PERSONAS.david)

export const LIVE_CHAT_SUPPORT_WAITING_COPY = {
  waiting: "Hayden or David will jump in",
  online: "Hayden or David will jump in",
} as const

export const LIVE_CHAT_SUPPORT_AVATAR_ALT = "Reswell customer support"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "RW"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
}

/** The teammate currently working this thread, if one has joined. */
export function resolveWorkingSupportAgent(
  messages: Array<{
    sender_type: string
    sender_agent_id?: string | null
    agent_display_name?: string | null
  }>,
  team: SupportFace[],
  assignedAgentId?: string | null,
): SupportFace | null {
  const lastAgent = [...messages].reverse().find((message) => message.sender_type === "agent")
  const joinLine = [...messages]
    .reverse()
    .find((message) => message.sender_type === "system" && isLiveChatJoinMessage(message.content))
  const agentId = lastAgent?.sender_agent_id ?? assignedAgentId ?? null
  if (agentId) {
    const match = team.find((member) => member.id === agentId)
    if (match) return match
  }

  const name = lastAgent?.agent_display_name?.trim()
  if (name) {
    const match = matchSupportTeamMemberByName(team, name)
    if (match) return match
    return {
      id: agentId ?? name,
      name,
      imageUrl: "",
      initials: initialsFromName(name),
    }
  }

  if (joinLine) {
    const firstName = joinLine.content.replace(/\s+joined the chat$/i, "").trim()
    const match = matchSupportTeamMemberByName(team, firstName)
    if (match) return match
  }

  return null
}

export function matchSupportTeamMemberByName(
  team: SupportFace[],
  name: string,
): SupportFace | undefined {
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return team.find((member) => {
    const full = member.name.toLowerCase()
    const first = member.name.trim().split(/\s+/)[0]?.toLowerCase()
    return full === needle || first === needle
  })
}
