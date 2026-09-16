export type LiveChatVisitorAccess =
  | { ok: true }
  | { ok: false; error: string; status: 401 | 403 }

export function liveChatVisitorAccessDecision(input: {
  adminOnly: boolean
  signedIn: boolean
  isAdmin: boolean
}): LiveChatVisitorAccess {
  if (!input.adminOnly) return { ok: true }
  if (!input.signedIn) return { ok: false, error: "Sign in required", status: 401 }
  if (!input.isAdmin) return { ok: false, error: "Admin only", status: 403 }
  return { ok: true }
}
