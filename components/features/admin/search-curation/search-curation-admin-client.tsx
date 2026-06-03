"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ListingPickerDialog } from "@/components/features/admin/search-curation/listing-picker-dialog"
import { Loader2, Plus, Trash2, Wand2, Pin, RefreshCw } from "lucide-react"

type SynonymRow = {
  id: string
  term: string
  expansions: string[]
  enabled: boolean
  updated_at: string
}

type OverrideListing = {
  rowId: string
  listingId: string
  title: string
  primaryImageUrl: string | null
  status: string | null
  hiddenFromSite: boolean | null
}

type OverrideRow = {
  id: string
  queryNormalized: string
  queryDisplay: string | null
  note: string | null
  enabled: boolean
  listings: OverrideListing[]
}

type ZeroResultRow = {
  query: string
  count: number
  suggestedBrand: { name: string; slug: string | null; distance: number } | null
  hasSynonym: boolean
  hasOverride: boolean
}

type Tab = "zero-results" | "synonyms" | "overrides"

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === "string" ? body.error : "Request failed"
}

export function SearchCurationAdminClient() {
  const [tab, setTab] = useState<Tab>("zero-results")

  // Zero-result queries
  const [days, setDays] = useState(30)
  const [zeroRows, setZeroRows] = useState<ZeroResultRow[]>([])
  const [zeroLoading, setZeroLoading] = useState(true)
  const [zeroConfigured, setZeroConfigured] = useState(true)

  // Synonyms
  const [synonyms, setSynonyms] = useState<SynonymRow[]>([])
  const [synLoading, setSynLoading] = useState(true)
  const [synTerm, setSynTerm] = useState("")
  const [synExpansions, setSynExpansions] = useState("")
  const [synSaving, setSynSaving] = useState(false)
  const [synBusyId, setSynBusyId] = useState<string | null>(null)

  // Overrides
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [ovrLoading, setOvrLoading] = useState(true)
  const [ovrQuery, setOvrQuery] = useState("")
  const [ovrSaving, setOvrSaving] = useState(false)
  const [ovrBusyId, setOvrBusyId] = useState<string | null>(null)

  // Listing picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerOverrideId, setPickerOverrideId] = useState<string | null>(null)

  const loadZero = useCallback(async () => {
    setZeroLoading(true)
    try {
      const res = await fetch(`/api/admin/search-curation/zero-results?days=${days}`, {
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(await readError(res))
        setZeroRows([])
        return
      }
      const body = await res.json()
      setZeroRows((body.data?.rows ?? []) as ZeroResultRow[])
      setZeroConfigured(body.data?.configured !== false)
    } catch {
      setZeroRows([])
    } finally {
      setZeroLoading(false)
    }
  }, [days])

  const loadSynonyms = useCallback(async () => {
    setSynLoading(true)
    try {
      const res = await fetch("/api/admin/search-curation/synonyms", { credentials: "include" })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      const body = await res.json()
      setSynonyms((body.data?.synonyms ?? []) as SynonymRow[])
    } finally {
      setSynLoading(false)
    }
  }, [])

  const loadOverrides = useCallback(async () => {
    setOvrLoading(true)
    try {
      const res = await fetch("/api/admin/search-curation/overrides", { credentials: "include" })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      const body = await res.json()
      setOverrides((body.data?.overrides ?? []) as OverrideRow[])
    } finally {
      setOvrLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadZero()
  }, [loadZero])
  useEffect(() => {
    void loadSynonyms()
    void loadOverrides()
  }, [loadSynonyms, loadOverrides])

  // --- Synonyms actions ----------------------------------------------------
  function parseExpansions(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    )
  }

  async function handleAddSynonym() {
    const term = synTerm.trim()
    const expansions = parseExpansions(synExpansions)
    if (!term || expansions.length === 0) {
      toast.error("Enter a term and at least one expansion")
      return
    }
    setSynSaving(true)
    try {
      const res = await fetch("/api/admin/search-curation/synonyms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, expansions }),
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success("Synonym added")
      setSynTerm("")
      setSynExpansions("")
      await loadSynonyms()
      await loadZero()
    } finally {
      setSynSaving(false)
    }
  }

  async function handleToggleSynonym(row: SynonymRow) {
    setSynBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/search-curation/synonyms/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !row.enabled }),
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      await loadSynonyms()
    } finally {
      setSynBusyId(null)
    }
  }

  async function handleDeleteSynonym(id: string) {
    setSynBusyId(id)
    try {
      const res = await fetch(`/api/admin/search-curation/synonyms/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success("Synonym removed")
      await loadSynonyms()
      await loadZero()
    } finally {
      setSynBusyId(null)
    }
  }

  // --- Override actions -----------------------------------------------------
  async function createOverrideForQuery(query: string): Promise<string | null> {
    const res = await fetch("/api/admin/search-curation/overrides", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) {
      toast.error(await readError(res))
      return null
    }
    const body = await res.json()
    return (body.data?.id as string) ?? null
  }

  async function handleCreateOverride() {
    const query = ovrQuery.trim()
    if (!query) {
      toast.error("Enter a query")
      return
    }
    setOvrSaving(true)
    try {
      const id = await createOverrideForQuery(query)
      if (!id) return
      toast.success("Override created")
      setOvrQuery("")
      await loadOverrides()
      setPickerOverrideId(id)
      setPickerOpen(true)
    } finally {
      setOvrSaving(false)
    }
  }

  async function handleToggleOverride(row: OverrideRow) {
    setOvrBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/search-curation/overrides/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !row.enabled }),
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      await loadOverrides()
    } finally {
      setOvrBusyId(null)
    }
  }

  async function handleDeleteOverride(id: string) {
    setOvrBusyId(id)
    try {
      const res = await fetch(`/api/admin/search-curation/overrides/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(await readError(res))
        return
      }
      toast.success("Override removed")
      await loadOverrides()
      await loadZero()
    } finally {
      setOvrBusyId(null)
    }
  }

  async function handleAddListing(overrideId: string, listingId: string) {
    const res = await fetch(`/api/admin/search-curation/overrides/${overrideId}/listings`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    })
    if (!res.ok) {
      toast.error(await readError(res))
      return
    }
    toast.success("Listing pinned")
    await loadOverrides()
    await loadZero()
  }

  async function handleRemoveListing(overrideId: string, rowId: string) {
    const res = await fetch(
      `/api/admin/search-curation/overrides/${overrideId}/listings/${rowId}`,
      { method: "DELETE", credentials: "include" },
    )
    if (!res.ok) {
      toast.error(await readError(res))
      return
    }
    await loadOverrides()
  }

  // --- Cross-tab actions from zero-result rows ------------------------------
  function prefillSynonym(query: string, expansion?: string | null) {
    setSynTerm(query)
    setSynExpansions(expansion ?? "")
    setTab("synonyms")
  }

  async function pinListingsForQuery(query: string) {
    const existing = overrides.find((o) => o.queryNormalized === query.trim().toLowerCase())
    let id = existing?.id ?? null
    if (!id) {
      id = await createOverrideForQuery(query)
      if (!id) return
      await loadOverrides()
    }
    setTab("overrides")
    setPickerOverrideId(id)
    setPickerOpen(true)
  }

  const pickerOverride = useMemo(
    () => overrides.find((o) => o.id === pickerOverrideId) ?? null,
    [overrides, pickerOverrideId],
  )
  const pickerPinnedIds = useMemo(
    () => new Set((pickerOverride?.listings ?? []).map((l) => l.listingId)),
    [pickerOverride],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Search curation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recover dead-end searches — add synonyms for misspellings/aliases, or pin listings to
          queries that return nothing.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="zero-results">Zero-result searches</TabsTrigger>
          <TabsTrigger value="synonyms">Synonyms ({synonyms.length})</TabsTrigger>
          <TabsTrigger value="overrides">Pinned results ({overrides.length})</TabsTrigger>
        </TabsList>

        {/* ---------------- Zero-result searches ---------------- */}
        <TabsContent value="zero-results" className="mt-4">
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Searches that returned nothing</h3>
                <p className="text-sm text-muted-foreground">
                  No brand, model, or listing matched. Add a synonym (fixes misspellings) or pin
                  listings to convert this demand.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="days" className="text-sm text-muted-foreground">
                  Last
                </Label>
                <select
                  id="days"
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => void loadZero()}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Refresh
                </Button>
              </div>
            </div>

            {!zeroConfigured ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Search analytics is not configured (Elasticsearch). Zero-result tracking is
                unavailable.
              </p>
            ) : zeroLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : zeroRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No zero-result searches in this range.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 font-medium">Query</th>
                      <th className="p-3 font-medium">Searches</th>
                      <th className="p-3 font-medium">Likely meant</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroRows.map((row) => (
                      <tr key={row.query} className="border-t border-border">
                        <td className="max-w-[220px] truncate p-3 font-medium" title={row.query}>
                          {row.query}
                        </td>
                        <td className="p-3 tabular-nums">{row.count}</td>
                        <td className="p-3">
                          {row.suggestedBrand ? (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <Wand2 className="h-3.5 w-3.5" />
                              {row.suggestedBrand.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {row.hasSynonym ? (
                              <Badge variant="secondary">synonym</Badge>
                            ) : null}
                            {row.hasOverride ? <Badge variant="secondary">pinned</Badge> : null}
                            {!row.hasSynonym && !row.hasOverride ? (
                              <span className="text-xs text-muted-foreground">unhandled</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                prefillSynonym(row.query, row.suggestedBrand?.name ?? null)
                              }
                            >
                              <Wand2 className="mr-1 h-4 w-4" /> Synonym
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void pinListingsForQuery(row.query)}
                            >
                              <Pin className="mr-1 h-4 w-4" /> Pin
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---------------- Synonyms ---------------- */}
        <TabsContent value="synonyms" className="mt-4">
          <div className="rounded-xl border border-border bg-background p-5">
            <h3 className="text-lg font-semibold">Add a synonym</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              When a shopper searches the <strong>term</strong>, results are widened with the{" "}
              <strong>expansions</strong>. Great for misspellings (chanel → channel) and aliases (ci
              → channel islands).
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="syn-term">Term (what they type)</Label>
                <Input
                  id="syn-term"
                  placeholder="e.g. ci"
                  value={synTerm}
                  onChange={(e) => setSynTerm(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="syn-exp">Expansions (comma-separated)</Label>
                <Input
                  id="syn-exp"
                  placeholder="e.g. channel islands"
                  value={synExpansions}
                  onChange={(e) => setSynExpansions(e.target.value)}
                />
              </div>
              <Button onClick={() => void handleAddSynonym()} disabled={synSaving}>
                {synSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add
              </Button>
            </div>

            <div className="mt-6">
              <h4 className="mb-2 text-sm font-medium text-foreground/90">Existing synonyms</h4>
              {synLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : synonyms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No synonyms yet.</p>
              ) : (
                <ul className="space-y-2">
                  {synonyms.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{row.term}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="text-muted-foreground">{row.expansions.join(", ")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.enabled}
                          disabled={synBusyId === row.id}
                          onCheckedChange={() => void handleToggleSynonym(row)}
                          aria-label="Enable synonym"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={synBusyId === row.id}
                          onClick={() => void handleDeleteSynonym(row.id)}
                          aria-label="Delete synonym"
                        >
                          {synBusyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Pinned results (overrides) ---------------- */}
        <TabsContent value="overrides" className="mt-4">
          <div className="rounded-xl border border-border bg-background p-5">
            <h3 className="text-lg font-semibold">Pin listings to a query</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              When organic search finds nothing for a query, shoppers see the listings you pin here.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1.5" style={{ minWidth: 220 }}>
                <Label htmlFor="ovr-query">Query</Label>
                <Input
                  id="ovr-query"
                  placeholder="e.g. pyzel ghost 6'2"
                  value={ovrQuery}
                  onChange={(e) => setOvrQuery(e.target.value)}
                />
              </div>
              <Button onClick={() => void handleCreateOverride()} disabled={ovrSaving}>
                {ovrSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Create &amp; pin
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              {ovrLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pinned queries yet.</p>
              ) : (
                overrides.map((ovr) => (
                  <div key={ovr.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {ovr.queryDisplay || ovr.queryNormalized}
                        </span>
                        {!ovr.enabled ? <Badge variant="outline">disabled</Badge> : null}
                        <span className="text-xs text-muted-foreground">
                          {ovr.listings.length} pinned
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ovr.enabled}
                          disabled={ovrBusyId === ovr.id}
                          onCheckedChange={() => void handleToggleOverride(ovr)}
                          aria-label="Enable override"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPickerOverrideId(ovr.id)
                            setPickerOpen(true)
                          }}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Add listing
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={ovrBusyId === ovr.id}
                          onClick={() => void handleDeleteOverride(ovr.id)}
                          aria-label="Delete override"
                        >
                          {ovrBusyId === ovr.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {ovr.listings.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ovr.listings.map((l) => (
                          <div
                            key={l.rowId}
                            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 py-1 pl-1 pr-2"
                          >
                            <span className="max-w-[160px] truncate text-xs" title={l.title}>
                              {l.title}
                            </span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${l.title}`}
                              onClick={() => void handleRemoveListing(ovr.id, l.rowId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ListingPickerDialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o)
          if (!o) setPickerOverrideId(null)
        }}
        pinnedIds={pickerPinnedIds}
        queryLabel={pickerOverride?.queryDisplay ?? pickerOverride?.queryNormalized ?? null}
        onPick={async (listingId) => {
          if (pickerOverrideId) await handleAddListing(pickerOverrideId, listingId)
        }}
      />
    </div>
  )
}
