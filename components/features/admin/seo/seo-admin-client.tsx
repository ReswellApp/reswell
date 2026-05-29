"use client"

import { useMemo, useState } from "react"
import { Loader2, RotateCcw, Save, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EMPTY_OVERRIDE, isOverrideEmpty, type ManagedPageSeoItem, type PageSeoOverrideValues } from "@/lib/seo/types"
import { SeoPageList } from "./seo-page-list"
import { SeoEditor } from "./seo-editor"

interface SeoAdminClientProps {
  initialItems: ManagedPageSeoItem[]
  siteOrigin: string
}

function cloneOverride(o: PageSeoOverrideValues): PageSeoOverrideValues {
  return JSON.parse(JSON.stringify(o)) as PageSeoOverrideValues
}

export function SeoAdminClient({ initialItems, siteOrigin }: SeoAdminClientProps) {
  const [items, setItems] = useState<ManagedPageSeoItem[]>(initialItems)
  const [drafts, setDrafts] = useState<Record<string, PageSeoOverrideValues>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(initialItems[0]?.key ?? null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  const itemByKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const selected = selectedKey ? itemByKey.get(selectedKey) ?? null : null
  const draft = selected ? drafts[selected.key] ?? selected.override : null

  const dirtyKeys = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      const d = drafts[it.key]
      if (d && JSON.stringify(d) !== JSON.stringify(it.override)) set.add(it.key)
    }
    return set
  }, [items, drafts])

  const isDirty = selected ? dirtyKeys.has(selected.key) : false

  function handleSelect(key: string) {
    setSelectedKey(key)
    setDrafts((prev) => (prev[key] ? prev : { ...prev, [key]: cloneOverride(itemByKey.get(key)!.override) }))
  }

  function handleChange(patch: Partial<PageSeoOverrideValues>) {
    if (!selected) return
    setDrafts((prev) => ({
      ...prev,
      [selected.key]: { ...(prev[selected.key] ?? selected.override), ...patch },
    }))
  }

  async function handleSave() {
    if (!selected || !draft) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/page-seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey: selected.key, ...draft }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Save failed")
      const saved = cloneOverride(draft)
      setItems((prev) =>
        prev.map((it) =>
          it.key === selected.key ? { ...it, override: saved, customized: !isOverrideEmpty(saved) } : it,
        ),
      )
      setDrafts((prev) => ({ ...prev, [selected.key]: saved }))
      toast.success("SEO saved", { description: selected.label })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/page-seo/${encodeURIComponent(selected.key)}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Reset failed")
      setItems((prev) =>
        prev.map((it) => (it.key === selected.key ? { ...it, override: EMPTY_OVERRIDE, customized: false } : it)),
      )
      setDrafts((prev) => ({ ...prev, [selected.key]: cloneOverride(EMPTY_OVERRIDE) }))
      toast.success("Reset to default", { description: selected.label })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setBusy(false)
    }
  }

  const customizedCount = items.filter((it) => it.customized).length

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-lg border border-border lg:h-[calc(100vh-9rem)] lg:sticky lg:top-4">
        <SeoPageList
          items={items}
          query={query}
          onQueryChange={setQuery}
          selectedKey={selectedKey}
          onSelect={handleSelect}
          dirtyKeys={dirtyKeys}
        />
      </div>

      <div className="min-w-0">
        {selected && draft ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {customizedCount} of {items.length} pages customized
                {isDirty ? <span className="ml-2 font-medium text-amber-600">• Unsaved changes</span> : null}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={busy || (!selected.customized && !isDirty)}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                  Reset to default
                </Button>
                <Button size="sm" onClick={handleSave} disabled={busy || !isDirty}>
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  Save changes
                </Button>
              </div>
            </div>
            <SeoEditor item={selected} draft={draft} onChange={handleChange} siteOrigin={siteOrigin} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <Search className="h-8 w-8" aria-hidden />
            <p className="text-sm">Select a page to edit its SEO.</p>
          </div>
        )}
      </div>
    </div>
  )
}
