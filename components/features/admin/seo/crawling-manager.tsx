"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Loader2, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

interface SeoSettings {
  discourageAllCrawlers: boolean
  extraDisallow: string[]
  extraAllow: string[]
  crawlDelay: number | null
  extraSitemaps: string[]
}

const SITEMAPS = [
  { label: "Sitemap index", path: "/sitemap.xml" },
  { label: "Pages", path: "/sitemap-pages.xml" },
  { label: "Listings", path: "/sitemap-listings.xml" },
]

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

export function CrawlingManager({ siteOrigin }: { siteOrigin: string }) {
  const [settings, setSettings] = useState<SeoSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  const [disallow, setDisallow] = useState("")
  const [allow, setAllow] = useState("")
  const [sitemaps, setSitemaps] = useState("")

  useEffect(() => {
    let active = true
    fetch("/api/admin/seo-settings")
      .then((r) => r.json())
      .then((b) => {
        if (!active) return
        const s = b?.data?.settings as SeoSettings | undefined
        if (s) {
          setSettings(s)
          setDisallow(s.extraDisallow.join("\n"))
          setAllow(s.extraAllow.join("\n"))
          setSitemaps(s.extraSitemaps.join("\n"))
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/seo-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discourageAllCrawlers: settings.discourageAllCrawlers,
          crawlDelay: settings.crawlDelay,
          extraDisallow: linesToList(disallow),
          extraAllow: linesToList(allow),
          extraSitemaps: linesToList(sitemaps),
        }),
      })
      if (!res.ok) throw new Error("Could not save settings")
      toast.success("Crawling settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings")
    } finally {
      setSaving(false)
    }
  }

  async function rebuild() {
    setRebuilding(true)
    try {
      const res = await fetch("/api/admin/seo-settings/rebuild-sitemap", { method: "POST" })
      if (!res.ok) throw new Error("Could not rebuild sitemap")
      toast.success("Sitemaps will rebuild on next crawl")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rebuild sitemap")
    } finally {
      setRebuilding(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">robots.txt</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Augments the built-in rules. Changes apply within ~5 minutes.
          </p>

          <div className="mt-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div>
              <Label htmlFor="kill-switch" className="text-xs font-medium text-foreground">
                Discourage all crawlers
              </Label>
              <p className="text-[11px] text-muted-foreground">Blocks the entire site. Use only for staging.</p>
            </div>
            <Switch
              id="kill-switch"
              checked={settings.discourageAllCrawlers}
              onCheckedChange={(c) => setSettings({ ...settings, discourageAllCrawlers: c })}
            />
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="disallow" className="text-xs font-medium text-foreground">
              Extra disallow paths (one per line)
            </Label>
            <Textarea
              id="disallow"
              rows={4}
              value={disallow}
              onChange={(e) => setDisallow(e.target.value)}
              placeholder={"/private\n/tmp"}
              className="font-mono text-xs"
            />
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="allow" className="text-xs font-medium text-foreground">
              Extra allow paths (one per line)
            </Label>
            <Textarea
              id="allow"
              rows={3}
              value={allow}
              onChange={(e) => setAllow(e.target.value)}
              placeholder={"/special-landing"}
              className="font-mono text-xs"
            />
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="crawl-delay" className="text-xs font-medium text-foreground">
              Crawl-delay (seconds, optional)
            </Label>
            <Input
              id="crawl-delay"
              type="number"
              min={0}
              max={60}
              value={settings.crawlDelay ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  crawlDelay: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-32 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Sitemaps</p>
            <Button variant="ghost" size="sm" onClick={rebuild} disabled={rebuilding}>
              {rebuilding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              Rebuild
            </Button>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Generated automatically. No-indexed pages are excluded from the pages sitemap.
          </p>
          <ul className="mt-3 space-y-1.5">
            {SITEMAPS.map((s) => (
              <li key={s.path}>
                <a
                  href={`${siteOrigin}${s.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-foreground hover:underline"
                >
                  <span className="font-mono text-muted-foreground">{s.path}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{s.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="extra-sitemaps" className="text-xs font-medium text-foreground">
              Additional sitemap URLs (one per line)
            </Label>
            <Textarea
              id="extra-sitemaps"
              rows={3}
              value={sitemaps}
              onChange={(e) => setSitemaps(e.target.value)}
              placeholder={"https://reswell.app/custom-sitemap.xml"}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <a
            href={`${siteOrigin}/robots.txt`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            View live robots.txt
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
