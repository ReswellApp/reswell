import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"

/** Default support face shown before API data loads (Hayden Garfield). */
export const LIVE_CHAT_SUPPORT_LEAD_FALLBACK: LiveChatSupportTeamMember = {
  id: "hayden-garfield",
  name: "Hayden Garfield",
  imageUrl: "/images/about/hayden-garfield.png",
  initials: "HG",
}

export const LIVE_CHAT_SUPPORT_WAITING_COPY = {
  waiting: "Waiting for the team",
  online: "The team is online",
} as const

export const LIVE_CHAT_SUPPORT_AVATAR_ALT = "Reswell customer support"

/** Decorative faces shown beside the lead admin to suggest a larger support team. */
export const LIVE_CHAT_ANONYMOUS_TEAM_AVATARS: Array<
  LiveChatSupportTeamMember & { avatarClassName?: string }
> = [
  {
    id: "support-team-a",
    name: "Support team",
    imageUrl: "",
    initials: "RS",
    avatarClassName: "bg-neutral-200 text-neutral-600",
  },
  {
    id: "support-team-b",
    name: "Support team",
    imageUrl: "",
    initials: "CS",
    avatarClassName: "bg-emerald-100 text-emerald-700",
  },
]
