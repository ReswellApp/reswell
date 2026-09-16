export const LIVE_CHAT_SESSION_CLOSED_CODE = "session_closed"
export const LIVE_CHAT_SESSION_MISSING_CODE = "session_missing"

export const LIVE_CHAT_SESSION_CLOSED_MESSAGE =
  "This chat is closed. Start a new conversation anytime."

export const LIVE_CHAT_SESSION_MISSING_MESSAGE = "Chat session not found."

export function isLiveChatSessionClosedPayload(payload: {
  code?: string
  error?: string
}): boolean {
  if (payload.code === LIVE_CHAT_SESSION_CLOSED_CODE) return true
  const error = payload.error?.toLowerCase() ?? ""
  return error.includes("chat is closed") || error.includes("start a new conversation")
}

export function isLiveChatSessionMissingPayload(payload: {
  code?: string
  error?: string
}): boolean {
  if (payload.code === LIVE_CHAT_SESSION_MISSING_CODE) return true
  const error = payload.error?.toLowerCase() ?? ""
  return error.includes("chat session not found")
}
