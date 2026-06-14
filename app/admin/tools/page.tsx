'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Loader2,
  Mail,
  Map,
  RefreshCw,
  Search,
  ShoppingBag,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { type RevalidateTarget } from '@/lib/validations/admin-tools'

type ToolId = 'reindex' | 'sitemap' | 'revalidate' | 'klaviyo'

interface ToolResult {
  ok: boolean
  text: string
}

const REVALIDATE_LABELS: Record<RevalidateTarget, string> = {
  home: 'Home page',
  brands: 'Brands directory',
  sellers: 'Sellers directory',
  blog: 'Blog',
  all: 'Everything (full site)',
}

const ACCENT: Record<'emerald' | 'sky' | 'amber' | 'violet' | 'neutral', string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  neutral: 'bg-secondary text-foreground',
}

interface ToolCardProps {
  icon: LucideIcon
  accent: keyof typeof ACCENT
  title: string
  description: string
  result?: ToolResult
  children: React.ReactNode
}

function ToolCard({ icon: Icon, accent, title, description, result, children }: ToolCardProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ACCENT[accent])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {result ? (
        <div
          className={cn(
            'mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
            result.ok
              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300',
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          <span className="min-w-0">{result.text}</span>
        </div>
      ) : null}
      <div className="mt-4 flex flex-1 items-end">{children}</div>
    </div>
  )
}

export default function AdminToolsPage() {
  const [running, setRunning] = useState<ToolId | null>(null)
  const [results, setResults] = useState<Partial<Record<ToolId, ToolResult>>>({})
  const [revalidateTarget, setRevalidateTarget] = useState<RevalidateTarget>('home')
  const [klaviyoConfirm, setKlaviyoConfirm] = useState(false)

  function setResult(id: ToolId, result: ToolResult) {
    setResults((prev) => ({ ...prev, [id]: result }))
  }

  async function runReindex() {
    setRunning('reindex')
    try {
      const res = await fetch('/api/search/reindex', { method: 'POST', credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as {
        indexed?: number
        errors?: number
        brandsIndexed?: number
        sellersIndexed?: number
        error?: string
      }
      if (!res.ok) {
        setResult('reindex', { ok: false, text: data.error || `Reindex failed (${res.status})` })
        toast.error(data.error || 'Reindex failed')
        return
      }
      const text = `${data.indexed ?? 0} listings · ${data.brandsIndexed ?? 0} brands · ${data.sellersIndexed ?? 0} sellers${
        data.errors ? ` · ${data.errors} errors` : ''
      }`
      setResult('reindex', { ok: true, text })
      toast.success('Search reindex complete')
    } catch {
      setResult('reindex', { ok: false, text: 'Reindex failed' })
      toast.error('Reindex failed')
    } finally {
      setRunning(null)
    }
  }

  async function runSitemap() {
    setRunning('sitemap')
    try {
      const res = await fetch('/api/admin/seo-settings/rebuild-sitemap', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setResult('sitemap', { ok: false, text: data.error || `Rebuild failed (${res.status})` })
        toast.error(data.error || 'Sitemap rebuild failed')
        return
      }
      setResult('sitemap', { ok: true, text: 'Sitemap routes will rebuild on next request.' })
      toast.success('Sitemap rebuild queued')
    } catch {
      setResult('sitemap', { ok: false, text: 'Sitemap rebuild failed' })
      toast.error('Sitemap rebuild failed')
    } finally {
      setRunning(null)
    }
  }

  async function runRevalidate() {
    setRunning('revalidate')
    try {
      const res = await fetch('/api/admin/revalidate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: revalidateTarget }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        data?: { paths?: string[] }
        error?: string
      }
      if (!res.ok) {
        setResult('revalidate', { ok: false, text: data.error || `Revalidate failed (${res.status})` })
        toast.error(data.error || 'Revalidate failed')
        return
      }
      const paths = data.data?.paths ?? []
      setResult('revalidate', {
        ok: true,
        text: `Refreshed ${REVALIDATE_LABELS[revalidateTarget]}${paths.length ? ` (${paths.join(', ')})` : ''}.`,
      })
      toast.success(`Refreshed ${REVALIDATE_LABELS[revalidateTarget]}`)
    } catch {
      setResult('revalidate', { ok: false, text: 'Revalidate failed' })
      toast.error('Revalidate failed')
    } finally {
      setRunning(null)
    }
  }

  async function runKlaviyo() {
    setKlaviyoConfirm(false)
    setRunning('klaviyo')
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/run', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        summaries?: { milestoneDays: number; eligible: number; emitted: number; failed: number }[]
        error?: string
      }
      if (!res.ok) {
        setResult('klaviyo', { ok: false, text: data.error || `Sync failed (${res.status})` })
        toast.error(data.error || 'Inactive sync failed')
        return
      }
      const text = Array.isArray(data.summaries)
        ? data.summaries.map((s) => `${s.milestoneDays}d: ${s.emitted}/${s.eligible} sent`).join(' · ')
        : 'Inactive Klaviyo sync finished'
      setResult('klaviyo', { ok: true, text })
      toast.success('Inactive Klaviyo sync complete')
    } catch {
      setResult('klaviyo', { ok: false, text: 'Inactive sync failed' })
      toast.error('Inactive sync failed')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Admin tools</h1>
            <Badge variant="secondary" className="gap-1">
              <Wrench className="h-3.5 w-3.5" /> Maintenance
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            One-click operational tools for search, caching, sitemaps, and lifecycle jobs.
          </p>
        </div>
      </div>

      {/* Search & content */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Search &amp; content
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <ToolCard
            icon={Search}
            accent="emerald"
            title="Reindex search"
            description="Rebuild the Elasticsearch listing, brand, and seller directory indexes used across search and typeahead."
            result={results.reindex}
          >
            <Button variant="outline" onClick={() => void runReindex()} disabled={running !== null}>
              {running === 'reindex' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {running === 'reindex' ? 'Reindexing…' : 'Reindex search'}
            </Button>
          </ToolCard>

          <ToolCard
            icon={Map}
            accent="sky"
            title="Rebuild sitemap"
            description="Force the sitemap routes (pages & listings) to regenerate on their next request."
            result={results.sitemap}
          >
            <Button variant="outline" onClick={() => void runSitemap()} disabled={running !== null}>
              {running === 'sitemap' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Map className="mr-2 h-4 w-4" />
              )}
              {running === 'sitemap' ? 'Rebuilding…' : 'Rebuild sitemap'}
            </Button>
          </ToolCard>
        </div>
      </section>

      {/* Cache & revalidation */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Cache &amp; revalidation
        </h2>
        <ToolCard
          icon={Zap}
          accent="amber"
          title="Revalidate cached pages"
          description="Purge the Next.js cache for a public surface so visitors see the freshest content immediately."
          result={results.revalidate}
        >
          <div className="flex w-full flex-wrap items-center gap-2">
            <Select
              value={revalidateTarget}
              onValueChange={(v) => setRevalidateTarget(v as RevalidateTarget)}
              disabled={running !== null}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REVALIDATE_LABELS) as RevalidateTarget[]).map((target) => (
                  <SelectItem key={target} value={target}>
                    {REVALIDATE_LABELS[target]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void runRevalidate()} disabled={running !== null}>
              {running === 'revalidate' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {running === 'revalidate' ? 'Refreshing…' : 'Revalidate'}
            </Button>
          </div>
        </ToolCard>
      </section>

      {/* Lifecycle & messaging */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Lifecycle &amp; messaging
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <ToolCard
            icon={Mail}
            accent="violet"
            title="Run inactive Klaviyo sync"
            description="Emit inactive-milestone events (3 / 15 / 30 day) to Klaviyo for every eligible account. Sends real emails."
            result={results.klaviyo}
          >
            <Button variant="outline" onClick={() => setKlaviyoConfirm(true)} disabled={running !== null}>
              {running === 'klaviyo' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {running === 'klaviyo' ? 'Running…' : 'Run sync'}
            </Button>
          </ToolCard>

          <ToolCard
            icon={ShoppingBag}
            accent="neutral"
            title="Test purchase"
            description="Open the test checkout flow to validate payments, wallet credits, and order creation end-to-end."
          >
            <Button variant="outline" asChild>
              <Link href="/admin/orders/test-purchase">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Open test purchase
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </ToolCard>
        </div>
      </section>

      {/* Diagnostics shortcut */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Diagnostics
        </h2>
        <ToolCard
          icon={Database}
          accent="sky"
          title="Search analytics"
          description="Inspect query volume, zero-result searches, and trends to validate indexing health."
        >
          <Button variant="outline" asChild>
            <Link href="/admin/search-analytics">
              <Database className="mr-2 h-4 w-4" />
              Open search analytics
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </ToolCard>
      </section>

      {/* Klaviyo confirmation */}
      <Dialog open={klaviyoConfirm} onOpenChange={setKlaviyoConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run inactive Klaviyo sync?</DialogTitle>
            <DialogDescription>
              This processes every account against the 3 / 15 / 30-day inactivity tiers and emits Klaviyo events,
              which can trigger real lifecycle emails. Already-recorded milestones are skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKlaviyoConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => void runKlaviyo()}>
              <Mail className="mr-2 h-4 w-4" /> Run sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
