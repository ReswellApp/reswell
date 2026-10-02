import { pathnameRequiresAuthSession } from "./pathname-requires-auth-session.ts"
import type { ServerSessionProbe } from "./wait-for-server-session-ready.ts"

export type LoginEntryAction = "show-form" | "clear-stale-session" | "redirect"

/**
 * What the login page should do after the client session probe.
 * A local session the server rejects must not navigate — middleware sends that
 * request straight back to login and the card stays on the spinner.
 */
export function resolveLoginEntryAction(input: {
  signedOut: boolean
  hasClientUser: boolean
  serverProbe: ServerSessionProbe
  redirectPath: string
}): LoginEntryAction {
  if (input.signedOut || !input.hasClientUser) return "show-form"
  if (input.serverProbe === "ready") return "redirect"
  if (input.serverProbe === "anonymous") return "clear-stale-session"

  const pathOnly = input.redirectPath.split("?")[0] ?? "/"
  if (!pathnameRequiresAuthSession(pathOnly)) return "redirect"
  return "show-form"
}
