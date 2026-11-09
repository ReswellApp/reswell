"use client"

/** Conversation currently on screen. Inbox ticker updates skip it so a reply you are reading does not flash the badge. */
let activeThreadId: string | null = null

export function setActiveMarketplaceThread(conversationId: string | null): void {
  activeThreadId = conversationId
}

export function getActiveMarketplaceThread(): string | null {
  return activeThreadId
}
