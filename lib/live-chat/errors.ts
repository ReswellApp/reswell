export const LIVE_CHAT_SESSION_CLOSED_CODE = "session_closed"

export const LIVE_CHAT_SESSION_CLOSED_MESSAGE =
  "This chat is closed. Start a new conversation anytime."

export function isLiveChatSessionClosedPayload(payload: {
  code?: string
  error?: string
}): boolean {
  if (payload.code === LIVE_CHAT_SESSION_CLOSED_CODE) return true
  const error = payload.error?.toLowerCase() ?? ""
  return error.includes("chat is closed") || error.includes("start a new conversation")
}
