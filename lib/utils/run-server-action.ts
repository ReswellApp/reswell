import { toast } from "sonner"

/**
 * True when a Server Action call failed because the client and server are from
 * different deployments (Next.js action IDs rotate per build unless encryption
 * keys are pinned). A full reload recovers.
 *
 * @see https://nextjs.org/docs/messages/failed-to-find-server-action
 */
export function isUnrecognizedServerActionError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false

  const name = "name" in error ? String(error.name) : ""
  if (name === "UnrecognizedActionError") return true

  const message = "message" in error ? String(error.message) : ""
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("was not recognized by the server")
  )
}

let reloadingForSkew = false

/**
 * Reload the document so the browser picks up the current deployment's
 * Server Action IDs. Returns true when the error was deploy skew (caller
 * should stop — do not show a generic failure toast).
 */
export function handleStaleServerActionError(error: unknown): boolean {
  if (!isUnrecognizedServerActionError(error)) return false
  if (typeof window === "undefined") return true
  if (reloadingForSkew) return true

  reloadingForSkew = true
  toast.message("Updating…")
  window.location.reload()
  return true
}

/**
 * Run a Server Action; on deploy skew, reload instead of surfacing a failure.
 * The returned promise never settles after a skew reload (avoids error toasts
 * flashing while the document unloads).
 */
export async function runServerAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (handleStaleServerActionError(error)) {
      await new Promise<never>(() => {})
    }
    throw error
  }
}
