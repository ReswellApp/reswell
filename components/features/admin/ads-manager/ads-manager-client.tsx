"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateAdsEntityAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsConnectionCards } from "@/components/features/admin/ads-manager/ads-connection-cards"
import { AdsCreateDialog } from "@/components/features/admin/ads-manager/ads-create-dialog"
import { AdsEditDialog } from "@/components/features/admin/ads-manager/ads-edit-dialog"
import { AdsEntityTable, type AdsTableRow } from "@/components/features/admin/ads-manager/ads-entity-table"
import { AdsKeywordDialog } from "@/components/features/admin/ads-manager/ads-keyword-dialog"
import { AdsKpiRow } from "@/components/features/admin/ads-manager/ads-kpi-row"
import type { AdVerdict, AdsManagerDashboard, AdsPlatform } from "@/lib/types/adsManager"

type TabId = "campaigns" | "ad_groups" | "ads" | "keywords"
type PlatformFilter = "all" | AdsPlatform
type VerdictFilter = "all" | AdVerdict

const RANGES = [7, 14, 30, 90] as const

export function AdsManagerClient({ initialData }: { initialData: AdsManagerDashboard }) {
  const [data, setData] = useState(initialData)
  const [days, setDays] = useState<(typeof RANGES)[number]>(initialData.rangeDays)
  const [tab, setTab] = useState<TabId>("campaigns")
  const [platform, setPlatform] = useState<PlatformFilter>("all")
  const [verdict, setVerdict] = useState<VerdictFilter>("all")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [addingKeyword, setAddingKeyword] = useState(false)
  const [editRow, setEditRow] = useState<AdsTableRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const rows = useMemo(() => filterRows(rowsForTab(data, tab), platform, verdict, query), [data, tab, platform, verdict, query])
  const editAd = editRow?.entity === "ad"
    ? data.ads.find((ad) => ad.platform === editRow.platform && ad.id === editRow.id) ?? null
    : null

  function load(nextDays: (typeof RANGES)[number]) {
    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch(`/api/admin/ads-manager?days=${nextDays}`, {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await response.json()) as { data?: AdsManagerDashboard; error?: string }
        if (!response.ok || !json.data) {
          setError(json.error || "Could not load ads")
          return
        }
        setData(json.data)
        setDays(nextDays)
      } catch {
        setError("Could not load ads")
      }
    })
  }

  function handleResult(result: AdsActionResult) {
    if ("error" in result) {
      setNotice(null)
      setError(result.error)
      return
    }
    setError(null)
    setNotice(result.message)
    load(days)
  }

  async function toggle(row: AdsTableRow) {
    const next = row.status === "enabled" ? "paused" : "enabled"
    if (next === "enabled" && !window.confirm("Enable this? It can start spending immediately.")) return
    setBusyKey(row.key)
    const result = await updateAdsEntityAction({
      platform: row.platform,
      entity: row.entity,
      id: row.id,
      parentId: row.parentId,
      kind: row.kind,
      status: next,
    })
    setBusyKey(null)
    handleResult(result)
  }

  return (
    <div className="space-y-4">
      <AdsConnectionCards accounts={data.accounts} />
      <AdsKpiRow data={data} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="ad_groups">Ad groups</TabsTrigger>
            <TabsTrigger value="ads">Ads</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
            New campaign
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAddingKeyword(true)}>
            Add keyword
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => load(days)}>
            <RefreshCw className={isPending ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={query} placeholder="Search name" onChange={(event) => setQuery(event.target.value)} />
        <FilterSelect value={platform} onChange={setPlatform} options={[["all", "All platforms"], ["google", "Google"], ["meta", "Meta"]]} />
        <FilterSelect
          value={verdict}
          onChange={setVerdict}
          options={[["all", "All reads"], ["winner", "Winners"], ["loser", "Needs work"], ["learning", "Learning"], ["paused", "Paused"], ["ok", "On pace"]]}
        />
        <FilterSelect value={String(days)} onChange={(value) => load(Number(value) as (typeof RANGES)[number])} options={RANGES.map((value) => [String(value), `${value} days`])} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <p className="text-xs text-muted-foreground">
        Winners beat this account’s CPA or ROAS. Weak rows spent without a conversion, or paid more than the account.
        Learning means there is not enough delivery to judge. Order-level sales are on{" "}
        <Link href="/admin/ad-sales" className="underline">
          Ad sales
        </Link>
        .
      </p>
      <AdsEntityTable rows={rows} busyKey={busyKey} onEdit={setEditRow} onToggle={(row) => void toggle(row)} />
      <AdsCreateDialog open={creating} onOpenChange={setCreating} onDone={handleResult} />
      <AdsKeywordDialog open={addingKeyword} onOpenChange={setAddingKeyword} onDone={handleResult} />
      <AdsEditDialog row={editRow} ad={editAd} onOpenChange={(open) => { if (!open) setEditRow(null) }} onDone={handleResult} />
    </div>
  )
}

function rowsForTab(data: AdsManagerDashboard, tab: TabId): AdsTableRow[] {
  if (tab === "campaigns") {
    return data.campaigns.map((row) => ({
      key: `campaign:${row.platform}:${row.id}`,
      platform: row.platform,
      entity: "campaign",
      id: row.id,
      name: row.name,
      subtitle: [row.channelLabel, row.deliveryNote].filter(Boolean).join(" · "),
      status: row.status,
      currency: row.currency,
      metrics: row.metrics,
      verdict: row.verdict,
    }))
  }
  if (tab === "ad_groups") {
    return data.adGroups.map((row) => ({
      key: `group:${row.platform}:${row.id}`,
      platform: row.platform,
      entity: "ad_group",
      id: row.id,
      kind: row.kind,
      name: row.name,
      subtitle: row.kind === "asset_group" ? "Asset group" : row.kind === "ad_set" ? "Ad set" : "Ad group",
      status: row.status,
      currency: row.currency,
      metrics: row.metrics,
      verdict: row.verdict,
    }))
  }
  if (tab === "ads") {
    return data.ads.map((row) => ({
      key: `ad:${row.platform}:${row.id}`,
      platform: row.platform,
      entity: "ad",
      id: row.id,
      name: row.name,
      subtitle: row.finalUrl || row.primaryText || row.headlines[0] || row.kind,
      status: row.status,
      currency: row.currency,
      metrics: row.metrics,
      verdict: row.verdict,
    }))
  }
  return data.keywords.map((row) => ({
    key: `keyword:${row.adGroupId}:${row.id}`,
    platform: "google",
    entity: "keyword",
    id: row.id,
    parentId: row.adGroupId,
    name: row.text,
    subtitle: `${row.matchType.toLowerCase()} match · ad group ${row.adGroupId}`,
    status: row.status,
    currency: row.currency,
    metrics: row.metrics,
    verdict: row.verdict,
  }))
}

function filterRows(rows: AdsTableRow[], platform: PlatformFilter, verdict: VerdictFilter, query: string): AdsTableRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (platform !== "all" && row.platform !== platform) return false
    if (verdict !== "all" && row.verdict !== verdict) return false
    if (needle && !row.name.toLowerCase().includes(needle) && !row.subtitle.toLowerCase().includes(needle)) return false
    return true
  })
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: [T, string][]
}) {
  return (
    <select
      className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}
