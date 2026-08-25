"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SearchQueryLookupResult } from "@/lib/services/searchAnalytics"

function formatOccurred(iso: string | null): string | null {
  if (!iso) return null
  try {
    return format(parseISO(iso), "MMM d, yyyy")
  } catch {
    return null
  }
}

export function SearchAnalyticsQueryLookup() {
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchQueryLookupResult | null>(null)

  async function runLookup(raw: string) {
    const q = raw.trim()
    if (!q) {
      setError("Enter a search query")
      setResult(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/search-analytics/query-lookup?q=${encodeURIComponent(q)}`,
        { credentials: "include" },
      )
      const body = (await res.json().catch(() => ({}))) as {
        data?: SearchQueryLookupResult
        error?: string
      }
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not look up query")
        setResult(null)
        return
      }
      setResult(body.data ?? null)
    } catch {
      setError("Could not look up query")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const first = formatOccurred(result?.firstOccurredAt ?? null)
  const last = formatOccurred(result?.lastOccurredAt ?? null)

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <form
        className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault()
          void runLookup(draft)
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="search-query-lookup" className="sr-only">
            Look up a marketplace search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="search-query-lookup"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Look up a query — e.g. firewire, lost rnf"
              autoComplete="off"
              className="h-10 border-slate-200 bg-white pl-9"
            />
          </div>
        </div>
        <Button type="submit" className="h-10 shrink-0" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "See all-time count"}
        </Button>
      </form>

      {error ? (
        <p className="border-t border-slate-100 px-6 py-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      {result && !result.configured ? (
        <p className="border-t border-slate-100 px-6 py-3 text-sm text-slate-600">
          Elasticsearch is not configured, so all-time counts are unavailable.
        </p>
      ) : null}

      {result?.configured ? (
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            All-time marketplace searches
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {result.allTimeCount.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {result.allTimeCount === 0 ? (
              <>No exact matches for “{result.queryNormalized}”.</>
            ) : (
              <>
                “{result.query}”
                {first && last ? (
                  <>
                    {" "}
                    · first {first} · last {last}
                  </>
                ) : null}
              </>
            )}
          </p>

          {result.related.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
              {result.related.map((row) => {
                const exact = row.query === result.queryNormalized
                return (
                  <li key={row.query}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setDraft(row.query)
                        void runLookup(row.query)
                      }}
                    >
                      <span className={exact ? "font-medium text-slate-900" : "text-slate-700"}>
                        {row.query}
                        {exact ? (
                          <span className="ml-2 text-xs font-normal text-slate-500">exact</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {row.count.toLocaleString()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
