/**
 * Cached public pages (listing PDPs, home) render `isLoggedIn=false` for every
 * visitor so the HTML can be shared. Client chrome then hydrates the real
 * session. Treat a viewer id or a confirmed browser session as signed in even
 * when the server flag is still false.
 */
export function resolveHydratedIsLoggedIn(input: {
  serverIsLoggedIn: boolean
  viewerUserId?: string | null
  clientLoggedIn: boolean
}): boolean {
  if (input.serverIsLoggedIn) return true
  if (input.viewerUserId) return true
  return input.clientLoggedIn
}
