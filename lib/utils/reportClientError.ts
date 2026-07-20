export type ReportClientErrorInput = {
  name?: string
  message: string
  stack?: string
  digest?: string
  url?: string
  path?: string
  severity?: "critical" | "warning" | "info"
  context?: Record<string, unknown>
}

export type ReportClientErrorResult = {
  groupId: string
  referenceCode: string
  eventId: string | null
} | null

const recentKeys = new Map<string, number>()
const DEDUPE_MS = 15_000

function dedupeKey(input: ReportClientErrorInput): string {
  return `${input.name ?? "Error"}|${input.message.slice(0, 120)}|${input.digest ?? ""}|${input.path ?? ""}`
}

/**
 * Fire-and-forget client error report. Safe to call from error boundaries.
 * Returns the ops reference code when the network call succeeds.
 */
export async function reportClientError(
  input: ReportClientErrorInput,
): Promise<ReportClientErrorResult> {
  if (typeof window === "undefined") return null

  const key = dedupeKey(input)
  const now = Date.now()
  const last = recentKeys.get(key)
  if (last && now - last < DEDUPE_MS) return null
  recentKeys.set(key, now)

  // Prune map occasionally
  if (recentKeys.size > 100) {
    for (const [k, ts] of recentKeys) {
      if (now - ts > DEDUPE_MS) recentKeys.delete(k)
    }
  }

  try {
    const res = await fetch("/api/ops/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "client",
        name: input.name,
        message: input.message,
        stack: input.stack,
        digest: input.digest,
        url: input.url ?? window.location.href,
        path: input.path ?? window.location.pathname,
        severity: input.severity ?? "critical",
        context: input.context,
        release:
          typeof process !== "undefined"
            ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
            : undefined,
      }),
      keepalive: true,
    })

    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { groupId?: string; referenceCode?: string; eventId?: string | null }
    }
    if (!json.data?.groupId || !json.data.referenceCode) return null
    return {
      groupId: json.data.groupId,
      referenceCode: json.data.referenceCode,
      eventId: json.data.eventId ?? null,
    }
  } catch {
    return null
  }
}
