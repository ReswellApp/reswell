"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Monitor, Moon, RefreshCw, Smartphone, Sun, Tablet, X } from "lucide-react"
import {
  withEmailPreviewData,
  withEmailPreviewSamples,
} from "@/lib/email-studio/render-html"
import type { EmailStudioPreviewEvent } from "@/lib/types/emailStudio"
import { cn } from "@/lib/utils"

interface PreviewResponse {
  metricName: string
  events: EmailStudioPreviewEvent[]
}

type PreviewTheme = "light" | "dark"
type PreviewDevice = "desktop" | "tablet" | "mobile"

const DEVICE_WIDTH: Record<Exclude<PreviewDevice, "desktop">, number> = {
  tablet: 768,
  mobile: 390,
}

const STAGE = {
  light: "#f7f6f2",
  dark: "#141414",
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

function applyPreviewSurface(html: string, theme: PreviewTheme): string {
  const background = STAGE[theme]
  const style = `<style id="preview-surface">html,body{background:${background}!important;margin:0!important;}body>table{background:transparent!important;}</style>`
  if (html.includes("</head>")) return html.replace("</head>", `${style}</head>`)
  return `${style}${html}`
}

export function EmailStudioLivePreview({
  projectId,
  metricName,
  html,
  onClose,
}: {
  projectId: string
  metricName: string
  html: string
  onClose: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [selectedId, setSelectedId] = useState("sample")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  const [theme, setTheme] = useState<PreviewTheme>("light")
  const [device, setDevice] = useState<PreviewDevice>("desktop")
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [contentHeight, setContentHeight] = useState(640)

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

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (!box) return
      setViewport({ width: Math.round(box.width), height: Math.round(box.height) })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const selected = data?.events.find((event) => event.id === selectedId) ?? null
  const previewHtml = useMemo(() => {
    const filled = selected
      ? withEmailPreviewData(html, {
          profile: {
            email: selected.profile?.email,
            firstName: selected.profile?.firstName,
            lastName: selected.profile?.lastName,
          },
          event: selected.properties,
        })
      : withEmailPreviewSamples(html)
    return applyPreviewSurface(filled, theme)
  }, [html, selected, theme])

  function measureFrame(): void {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    const next = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0)
    if (next > 0) setContentHeight(next)
    doc.querySelectorAll("img").forEach((image) => {
      if (image.complete) return
      image.addEventListener("load", measureFrame, { once: true })
    })
  }

  const frameWidth = device === "desktop" ? viewport.width : Math.min(DEVICE_WIDTH[device], viewport.width || DEVICE_WIDTH[device])
  const shownWidth = frameWidth || (device === "desktop" ? viewport.width : DEVICE_WIDTH[device])
  const shownHeight = viewport.height

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-[#18181b]">
      <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[#eceae6] bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <p className="hidden shrink-0 text-sm text-[#6b6b6b] sm:block">Preview mode</p>
          {metricName ? (
            <div className="hidden min-w-0 items-center gap-1 md:flex">
              <select
                className="h-8 min-w-0 max-w-[240px] truncate rounded-md border border-[#eceae6] bg-white px-2 text-xs text-[#3f3f46]"
                aria-label="Preview profile and event"
                title={error || undefined}
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
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b6b6b] hover:bg-[#f4f4f5]"
                aria-label="Refresh live Klaviyo events"
                disabled={loading}
                onClick={() => setReload((value) => value + 1)}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {([
              ["light", "Light background", Sun],
              ["dark", "Dark background", Moon],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={theme === value}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md",
                  theme === value ? "bg-[#7C5CFC] text-white" : "text-[#8a8a8a] hover:bg-[#f4f4f5]",
                )}
                onClick={() => setTheme(value)}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {([
              ["desktop", "Desktop preview", Monitor],
              ["tablet", "Tablet preview", Tablet],
              ["mobile", "Mobile preview", Smartphone],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={device === value}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md",
                  device === value ? "bg-[#7C5CFC] text-white" : "text-[#8a8a8a] hover:bg-[#f4f4f5]",
                )}
                onClick={() => setDevice(value)}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <p className="hidden rounded-md bg-[#f3f3f4] px-2.5 py-1.5 text-[13px] tabular-nums tracking-wide text-[#3f3f46] sm:block">
            {shownWidth || "—"} × {shownHeight || "—"}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#3f3f46] hover:bg-[#f4f4f5]"
            aria-label="Close preview"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        ref={stageRef}
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          device === "desktop" ? "px-0 py-0" : "px-6 py-10",
        )}
        style={{ background: STAGE[theme] }}
      >
        <iframe
          ref={frameRef}
          title={selected ? `Email preview for ${profileLabel(selected)}` : "Email preview with sample data"}
          sandbox="allow-same-origin"
          srcDoc={previewHtml}
          onLoad={measureFrame}
          style={{
            width: device === "desktop" ? "100%" : frameWidth,
            height: contentHeight,
            background: STAGE[theme],
          }}
          className="mx-auto block max-w-full border-0"
        />
        {selected ? (
          <p className="sr-only">
            {profileLabel(selected)} · {selected.metricName} · {eventTime(selected.occurredAt)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
