import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

/** Default support face shown before API data loads (Hayden Garfield). */
export const LIVE_CHAT_SUPPORT_LEAD_FALLBACK: LiveChatSupportTeamMember = {
  id: "hayden-garfield",
  name: "Hayden Garfield",
  imageUrl: "/images/about/hayden-garfield.png",
  initials: "HG",
}

export const LIVE_CHAT_SUPPORT_WAITING_COPY = {
  waiting: "We'll reply here, usually within one business day",
  online: "We'll reply here as soon as we can",
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
  team: LiveChatSupportTeamMember[],
  assignedAgentId?: string | null,
): LiveChatSupportTeamMember | null {
  const lastAgent = [...messages].reverse().find((message) => message.sender_type === "agent")
  const agentId = lastAgent?.sender_agent_id ?? assignedAgentId ?? null
  if (agentId) {
    const match = team.find((member) => member.id === agentId)
    if (match) return match
  }

  const name = lastAgent?.agent_display_name?.trim()
  if (name) {
    const match = team.find((member) => member.name.toLowerCase() === name.toLowerCase())
    if (match) return match
    return {
      id: agentId ?? name,
      name,
      imageUrl: "",
      initials: initialsFromName(name),
    }
  }

  return null
}
