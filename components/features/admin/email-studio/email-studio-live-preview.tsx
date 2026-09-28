"use client"

import { useEffect, useMemo, useState } from "react"
import { Database, Loader2, RefreshCw, UserRound } from "lucide-react"
import {
  withEmailPreviewData,
  withEmailPreviewSamples,
} from "@/lib/email-studio/render-html"
import type { EmailStudioPreviewEvent } from "@/lib/types/emailStudio"
import { Button } from "@/components/ui/button"

interface PreviewResponse {
  metricName: string
  events: EmailStudioPreviewEvent[]
}

function profileLabel(event: EmailStudioPreviewEvent): string {
  const name = [event.profile?.firstName, event.profile?.lastName].filter(Boolean).join(" ")
  return name || event.profile?.email || "Unknown profile"
}

function eventTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function EmailStudioLivePreview({
  projectId,
  metricName,
  html,
  width,
}: {
  projectId: string
  metricName: string
  html: string
  width: number
}) {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [selectedId, setSelectedId] = useState("sample")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!metricName.trim()) {
      setData(null)
      setSelectedId("sample")
      setError("")
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError("")
    void fetch(
      `/api/admin/email-studio/preview-events?projectId=${encodeURIComponent(projectId)}`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as {
          data?: PreviewResponse
          error?: string
        }
        if (!response.ok || !body.data) {
          throw new Error(body.error || "Could not load live preview data")
        }
        const nextData = body.data
        setData(nextData)
        setSelectedId((current) => (
          current !== "sample" && nextData.events.some((event) => event.id === current)
            ? current
            : nextData.events[0]?.id ?? "sample"
        ))
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return
        setError(fetchError instanceof Error ? fetchError.message : "Could not load live preview data")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [metricName, projectId, reload])

  const selected = data?.events.find((event) => event.id === selectedId) ?? null
  const previewHtml = useMemo(() => {
    if (!selected) return withEmailPreviewSamples(html)
    return withEmailPreviewData(html, {
      profile: {
        email: selected.profile?.email,
        firstName: selected.profile?.firstName,
        lastName: selected.profile?.lastName,
      },
      event: selected.properties,
    })
  }, [html, selected])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0 text-[#355185]" />
            <select
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Preview profile and event"
              value={selectedId}
              disabled={loading}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="sample">Sample data</option>
              {(data?.events ?? []).map((event) => (
                <option key={event.id} value={event.id}>
                  {profileLabel(event)} · {eventTime(event.occurredAt)}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            aria-label="Refresh live Klaviyo events"
            disabled={!metricName.trim() || loading}
            onClick={() => setReload((value) => value + 1)}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
        {selected ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="h-3 w-3" />
              {profileLabel(selected)}
            </span>
            <span>{selected.metricName}</span>
            <span>{eventTime(selected.occurredAt)}</span>
            <details>
              <summary className="cursor-pointer text-[#355185]">Event data</summary>
              <pre className="absolute z-20 mt-1 max-h-64 max-w-lg overflow-auto rounded-md border border-border bg-background p-3 text-[10px] text-foreground shadow-lg">
                {JSON.stringify(selected.properties, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {loading
              ? `Loading recent ${metricName} events from Klaviyo…`
              : error
                ? `${error} Showing sample data.`
                : metricName
                  ? `No recent ${metricName} events found. Showing sample data.`
                  : "Choose a trigger metric to preview with live event data."}
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <iframe
          title={selected ? `Email preview for ${profileLabel(selected)}` : "Email preview with sample data"}
          sandbox=""
          srcDoc={previewHtml}
          style={{ width }}
          className="mx-auto block h-[720px] max-w-full rounded-md border border-border bg-white"
        />
      </div>
    </div>
  )
}
