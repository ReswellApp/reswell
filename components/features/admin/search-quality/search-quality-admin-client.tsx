"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw } from "lucide-react"
import type { SearchQualityEventRow, SearchQualityStats } from "@/lib/db/searchQuality"
import type { SearchQualityRating } from "@/lib/validations/searchQuality"

type RatingFilter = "unrated" | "good" | "close" | "bad" | "all"

const LIVE_POLL_MS = 3000

function pct(n: number | null): string {
  if (n == null) return "—"
  return `${Math.round(n * 1000) / 10}%`
}

function ratingClass(rating: SearchQualityRating | null): string {
  if (rating === "good") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (rating === "close") return "border-amber-200 bg-amber-50 text-amber-900"
  if (rating === "bad") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

export function SearchQualityAdminClient() {
  const [days, setDays] = useState(14)
  const [rating, setRating] = useState<RatingFilter>("all")
  const [qInput, setQInput] = useState("")
  const [q, setQ] = useState("")
  const [llmOnly, setLlmOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<SearchQualityEventRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<SearchQualityStats | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [followLive, setFollowLive] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const followLiveRef = useRef(followLive)
  const savingRef = useRef(saving)

  useEffect(() => {
    followLiveRef.current = followLive
  }, [followLive])
  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput), 300)
    return () => window.clearTimeout(t)
  }, [qInput])

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? events[0] ?? null,
    [events, selectedId],
  )
  const latestId = events[0]?.id ?? null

  useEffect(() => {
    setNote(selected?.ratingNote ?? "")
  }, [selected?.id, selected?.ratingNote])

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        days: String(days),
        rating,
        q,
        llmOnly: llmOnly ? "1" : "0",
        limit: "40",
      })
      const res = await fetch(`/api/admin/search-quality?${params.toString()}`)
      const body = (await res.json().catch(() => ({}))) as {
        data?: { events: SearchQualityEventRow[]; total: number; stats: SearchQualityStats }
        error?: string
      }
      if (!res.ok) {
        const message = body.error || "Could not load search quality"
        setLoadError(message)
        if (!silent) toast.error(message)
        return
      }
      setLoadError(null)
      const next = body.data?.events ?? []
      setEvents(next)
      setTotal(body.data?.total ?? 0)
      setStats(body.data?.stats ?? null)
      const newestId = next[0]?.id ?? null
      setSelectedId((prev) => {
        if (followLiveRef.current) return newestId
        if (prev && next.some((e) => e.id === prev)) return prev
        return newestId
      })
    } catch {
      setLoadError("Could not load search quality")
      if (!silent) toast.error("Could not load search quality")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [days, rating, q, llmOnly])

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => {
      if (document.hidden || savingRef.current) return
      void load(true)
    }, LIVE_POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  function selectEvent(id: string) {
    setSelectedId(id)
    setFollowLive(id === latestId)
  }

  function resumeLive() {
    setFollowLive(true)
    if (latestId) setSelectedId(latestId)
  }

  async function rate(field: "resultRating" | "llmRating", value: SearchQualityRating) {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/search-quality/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: value,
          note: note.trim() || null,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: SearchQualityEventRow
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Could not save rating")
        return
      }
      setEvents((prev) => prev.map((e) => (e.id === body.data!.id ? body.data! : e)))
      toast.success("Saved — the NL helper will use this on the next similar search")
    } catch {
      toast.error("Could not save rating")
    } finally {
      setSaving(false)
    }
  }

  async function rateListing(listingId: string, value: SearchQualityRating) {
    if (!selected) return
    const eventId = selected.id
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, listingRatings: { ...event.listingRatings, [listingId]: value } }
          : event,
      ),
    )
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/search-quality/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, listingRating: value }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        data?: SearchQualityEventRow
        error?: string
      }
      if (!res.ok || !body.data) {
        toast.error(body.error || "Could not save listing rating")
        void load(true)
        return
      }
      setEvents((prev) => prev.map((e) => (e.id === body.data!.id ? body.data! : e)))
    } catch {
      toast.error("Could not save listing rating")
      void load(true)
    } finally {
      setSaving(false)
    }
  }

  const onTarget = (stats?.acceptableRate ?? 0) >= (stats?.target ?? 0.95) && (stats?.rated ?? 0) > 0

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search</p>
        <h2 className="text-xl font-semibold text-foreground">Search quality</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The latest marketplace search opens here live. Rate the whole set or each listing Good,
          Close, or Bad — that memory is fed back into the next NL parse. Target: 95% of rated
          searches Good or Close.
        </p>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Captured searches" value={String(stats.total)} />
          <StatCard label="Unrated" value={String(stats.unrated)} />
          <StatCard
            label="Acceptable (Good + Close)"
            value={pct(stats.acceptableRate)}
            hint={`${stats.rated} rated · target ${pct(stats.target)}`}
            tone={onTarget ? "good" : stats.rated === 0 ? "neutral" : "warn"}
          />
          <StatCard
            label="LLM helped"
            value={String(stats.llmHelped)}
            hint={`${stats.good} good · ${stats.close} close · ${stats.bad} bad`}
          />
        </div>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="sq-days">Days</Label>
          <Input
            id="sq-days"
            type="number"
            min={1}
            max={90}
            className="w-20"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 14)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sq-q">Query</Label>
          <Input
            id="sq-q"
            className="w-48"
            placeholder="Filter by search text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Rating</Label>
          <div className="flex flex-wrap gap-1">
            {(["all", "unrated", "good", "close", "bad"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={rating === key ? "default" : "outline"}
                onClick={() => setRating(key)}
              >
                {key}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            checked={llmOnly}
            onChange={(e) => setLlmOnly(e.target.checked)}
          />
          LLM only
        </label>
        <Button
          type="button"
          variant={followLive ? "default" : "outline"}
          size="sm"
          onClick={() => (followLive ? setFollowLive(false) : resumeLive())}
        >
          <span
            className={cn(
              "mr-2 inline-flex h-2 w-2 rounded-full",
              followLive ? "animate-pulse bg-emerald-300" : "bg-slate-400",
            )}
          />
          {followLive ? "Live" : "Paused"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void load(false)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border p-2">
          {loading && events.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</li>
          ) : events.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              Waiting for a marketplace search. Keep this tab open — the latest result appears here
              automatically.
            </li>
          ) : (
            events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => selectEvent(event.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm",
                    selected?.id === event.id ? "bg-slate-100" : "hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="block min-w-0 truncate font-medium text-foreground">
                      {event.queryDisplay}
                    </span>
                    {event.id === latestId ? (
                      <Badge variant="secondary" className="shrink-0">
                        Latest
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span>{event.resultCount} listings</span>
                    <span>· {event.searchSurface}</span>
                    {event.nlSkipped === false ? <Badge variant="secondary">LLM</Badge> : null}
                    {event.resultRating ? (
                      <span className={cn("rounded-full border px-1.5 py-px", ratingClass(event.resultRating))}>
                        {event.resultRating}
                      </span>
                    ) : (
                      <span>unrated</span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
          {total > events.length ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Showing {events.length} of {total}</li>
          ) : null}
        </ul>

        {selected ? (
          <EventDetail
            event={selected}
            isLatest={selected.id === latestId}
            note={note}
            onNoteChange={setNote}
            saving={saving}
            onRate={rate}
            onRateListing={rateListing}
          />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            Run a marketplace search. The listings will show here so you can rate Good, Close, or Bad.
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint?: string
  tone?: "neutral" | "good" | "warn"
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "good" && "border-emerald-200 bg-emerald-50/60",
        tone === "warn" && "border-amber-200 bg-amber-50/60",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function EventDetail({
  event,
  isLatest,
  note,
  onNoteChange,
  saving,
  onRate,
  onRateListing,
}: {
  event: SearchQualityEventRow
  isLatest: boolean
  note: string
  onNoteChange: (v: string) => void
  saving: boolean
  onRate: (field: "resultRating" | "llmRating", value: SearchQualityRating) => void
  onRateListing: (listingId: string, value: SearchQualityRating) => void
}) {
  const rules = event.rulesSnapshot
  const nl = event.nlHelper
  const listingRatedCount = Object.keys(event.listingRatings).length

  return (
    <div className="space-y-5 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">&ldquo;{event.queryDisplay}&rdquo;</h3>
          <p className="text-xs text-muted-foreground">
            {new Date(event.occurredAt).toLocaleString()} · {event.searchSurface} ·{" "}
            {event.backend ?? "unknown backend"}
          </p>
        </div>
        {isLatest ? <Badge variant="secondary">Live latest</Badge> : null}
      </div>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold">Rate this match</p>
        <RatingRow
          current={event.resultRating}
          disabled={saving}
          onPick={(v) => onRate("resultRating", v)}
        />
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        {rules.brand ? <Badge variant="secondary">Brand {rules.brand}</Badge> : null}
        {rules.model ? <Badge variant="secondary">Model {rules.model}</Badge> : null}
        {rules.styles.map((s) => (
          <Badge key={s} variant="outline">
            Style {s}
          </Badge>
        ))}
        {rules.lengthToken ? <Badge variant="outline">{rules.lengthToken}</Badge> : null}
        {rules.isBrandOnly ? <Badge variant="outline">Brand-only</Badge> : null}
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">
          Listings shown ({event.listingsPreview.length}
          {listingRatedCount > 0 ? ` · ${listingRatedCount} rated` : ""})
        </h4>
        {event.listingsPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings returned.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {event.listingsPreview.map((listing) => (
              <li key={listing.id} className="flex gap-2 rounded-lg border p-2">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-slate-100">
                  {listing.imageUrl ? (
                    <Image src={listing.imageUrl} alt="" fill className="object-cover" sizes="56px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <Link
                      href={listing.slug ? `/listings/${listing.slug}` : `/listings/${listing.id}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                      target="_blank"
                    >
                      {listing.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {listing.boardType ?? "board"}
                      {listing.price != null ? ` · $${Math.round(listing.price)}` : null}
                    </p>
                  </div>
                  <RatingRow
                    current={event.listingRatings[listing.id] ?? null}
                    disabled={saving}
                    compact
                    onPick={(v) => onRateListing(listing.id, v)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-lg bg-slate-50 p-3">
        <h4 className="text-sm font-semibold">LLM helper</h4>
        {event.nlSkipped == null && !nl ? (
          <p className="text-sm text-muted-foreground">
            Gemini did not run on this search (rules-only, or helper has not reported yet).
          </p>
        ) : event.nlSkipped ? (
          <p className="text-sm text-muted-foreground">
            Skipped{nl?.reason ? ` (${nl.reason})` : ""}.
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            {nl?.summary ? <p>{nl.summary}</p> : null}
            {nl?.appliedLabels?.length ? (
              <p className="text-muted-foreground">Labels: {nl.appliedLabels.join(", ")}</p>
            ) : null}
            {nl?.rankedIds?.length ? (
              <p className="text-muted-foreground">
                Ranked {nl.rankedIds.length} listing{nl.rankedIds.length === 1 ? "" : "s"}
                {nl.dropIds?.length ? ` · dropped ${nl.dropIds.length}` : ""}
              </p>
            ) : null}
            {nl?.extraPhrases?.length ? (
              <p className="text-muted-foreground">Extra phrases: {nl.extraPhrases.join(", ")}</p>
            ) : null}
            {nl?.refine && Object.keys(nl.refine).length > 0 ? (
              <pre className="overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-700">
                {JSON.stringify(nl.refine, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
        <div className="space-y-2 pt-1">
          <p className="text-sm font-medium">LLM match</p>
          <RatingRow
            current={event.llmRating}
            disabled={saving || (event.nlSkipped !== false && !nl)}
            onPick={(v) => onRate("llmRating", v)}
          />
        </div>
      </section>

      <div>
        <Label htmlFor="sq-note">Note for the model (optional)</Label>
        <Input
          id="sq-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g. fish is a board shape, not Fish Stix"
        />
      </div>
    </div>
  )
}

function RatingRow({
  current,
  disabled,
  compact = false,
  onPick,
}: {
  current: SearchQualityRating | null
  disabled: boolean
  compact?: boolean
  onPick: (v: SearchQualityRating) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["good", "close", "bad"] as const).map((key) => (
        <Button
          key={key}
          type="button"
          size={compact ? "sm" : "default"}
          disabled={disabled}
          variant={current === key ? "default" : "outline"}
          className={cn(
            "capitalize",
            compact ? "h-7 px-2 text-xs" : "min-w-20",
            current === key && ratingClass(key),
          )}
          onClick={() => onPick(key)}
        >
          {key === "good" ? "Good" : key === "close" ? "Close" : "Bad"}
        </Button>
      ))}
    </div>
  )
}
