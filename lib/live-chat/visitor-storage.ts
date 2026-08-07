const VISITOR_TOKEN_KEY = "reswell-live-chat-visitor-token"
const SESSION_PUBLIC_ID_KEY = "reswell-live-chat-session-public-id"
const VISITOR_NAME_KEY = "reswell-live-chat-visitor-name"

export function getOrCreateLiveChatVisitorToken(): string {
  if (typeof localStorage === "undefined") {
    return crypto.randomUUID()
  }
  let token = localStorage.getItem(VISITOR_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(VISITOR_TOKEN_KEY, token)
  }
  return token
}

export function getStoredLiveChatSessionPublicId(): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(SESSION_PUBLIC_ID_KEY)
}

export function setStoredLiveChatSessionPublicId(publicId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(SESSION_PUBLIC_ID_KEY, publicId)
}

export function clearStoredLiveChatSessionPublicId(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(SESSION_PUBLIC_ID_KEY)
}

export function getStoredLiveChatVisitorName(): string | null {
  if (typeof localStorage === "undefined") return null
  const name = localStorage.getItem(VISITOR_NAME_KEY)?.trim()
  return name || null
}

export function setStoredLiveChatVisitorName(name: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(VISITOR_NAME_KEY, name.trim())
}
