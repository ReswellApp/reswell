"use client"

import Link from "next/link"
import { ExternalLink, RotateCcw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { computeEffectivePageSeo, type ManagedPageSeoItem, type PageSeoOverrideValues } from "@/lib/seo/types"
import { FieldCounter } from "./field-counter"
import { SeoImageField } from "./seo-image-field"
import { SerpPreview } from "./serp-preview"
import { SocialPreview } from "./social-preview"
import { SeoScore } from "./seo-score"
import { SeoSearchInsights } from "./seo-search-insights"
import { SeoAiSuggest } from "./seo-ai-suggest"
import { SeoHistory } from "./seo-history"
import { scorePageSeo, SEO_LIMITS } from "./seo-scoring"
import { structuredDataTemplate } from "@/lib/seo/structured-data"

interface SeoEditorProps {
  item: ManagedPageSeoItem
  draft: PageSeoOverrideValues
  onChange: (patch: Partial<PageSeoOverrideValues>) => void
  onRestored: (snapshot: PageSeoOverrideValues) => void
  siteOrigin: string
  faviconUrl?: string | null
}

function Segmented<T extends string>(props: {
  value: T | null
  options: { value: T; label: string }[]
  defaultLabel: string
  onChange: (value: T | null) => void
}) {
  const { value, options, defaultLabel, onChange } = props
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded px-2.5 py-1 text-xs transition-colors",
          value === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {defaultLabel}
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === opt.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function structuredDataText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

export function SeoEditor({ item, draft, onChange, onRestored, siteOrigin, faviconUrl }: SeoEditorProps) {
  const effective = computeEffectivePageSeo(item.defaults, draft)
  const score = scorePageSeo(effective)
  const text = (v: string | null | undefined) => v ?? ""
  const setText = (key: keyof PageSeoOverrideValues) => (value: string) =>
    onChange({ [key]: value === "" ? null : value } as Partial<PageSeoOverrideValues>)
  const reset = (key: keyof PageSeoOverrideValues) => () =>
    onChange({ [key]: null } as Partial<PageSeoOverrideValues>)

  const keywordsValue = draft.keywords?.join(", ") ?? ""

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{item.label}</h2>
          {item.customized ? <Badge variant="secondary">Customized</Badge> : <Badge variant="outline">Default</Badge>}
          {item.override.robotsIndex === false ? <Badge variant="destructive">No-index</Badge> : null}
          <Link
            href={item.defaults.path}
            target="_blank"
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="font-mono">{item.defaults.path}</span>
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                Let AI draft a title &amp; description for this page.
              </p>
              <SeoAiSuggest
                pageKey={item.key}
                currentTitle={effective.title}
                currentDescription={effective.description}
                keywords={draft.keywords ?? undefined}
                onApply={({ title, description }) =>
                  onChange({
                    ...(title ? { title } : {}),
                    ...(description ? { description } : {}),
                  })
                }
              />
            </div>
            <FieldCounter
              id="seo-title"
              label="Meta title"
              value={text(draft.title)}
              onChange={setText("title")}
              placeholder={item.defaults.title}
              band={SEO_LIMITS.title}
              overridden={!!draft.title}
              onReset={reset("title")}
            />
            <FieldCounter
              id="seo-description"
              label="Meta description"
              value={text(draft.description)}
              onChange={setText("description")}
              placeholder={item.defaults.description}
              band={SEO_LIMITS.description}
              multiline
              overridden={!!draft.description}
              onReset={reset("description")}
            />
            <FieldCounter
              id="seo-keywords"
              label="Keywords (comma separated)"
              value={keywordsValue}
              onChange={(v) => {
                const arr = v.split(",").map((k) => k.trim()).filter(Boolean)
                onChange({ keywords: arr.length ? arr : null })
              }}
              helpText="Optional. Not a strong ranking signal, but useful for internal organization."
              overridden={!!draft.keywords?.length}
              onReset={reset("keywords")}
            />
            <FieldCounter
              id="seo-canonical"
              label="Canonical URL"
              value={text(draft.canonicalUrl)}
              onChange={setText("canonicalUrl")}
              placeholder={item.defaults.path}
              helpText="Leave blank to use the page's own path. Use an absolute https:// URL to point elsewhere."
              mono
              overridden={!!draft.canonicalUrl}
              onReset={reset("canonicalUrl")}
            />
            <div className="flex flex-wrap gap-6 rounded-md border border-border p-3">
              <RobotsToggle
                label="Indexable"
                hint="Allow search engines to index this page"
                value={draft.robotsIndex}
                fallback={item.defaults.robotsIndex}
                onChange={(v) => onChange({ robotsIndex: v })}
              />
              <RobotsToggle
                label="Follow links"
                hint="Allow crawlers to follow links on this page"
                value={draft.robotsFollow}
                fallback={item.defaults.robotsFollow}
                onChange={(v) => onChange({ robotsFollow: v })}
              />
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4 pt-2">
            <FieldCounter
              id="og-title"
              label="Open Graph title"
              value={text(draft.ogTitle)}
              onChange={setText("ogTitle")}
              placeholder={effective.title}
              band={SEO_LIMITS.ogTitle}
              overridden={!!draft.ogTitle}
              onReset={reset("ogTitle")}
            />
            <FieldCounter
              id="og-description"
              label="Open Graph description"
              value={text(draft.ogDescription)}
              onChange={setText("ogDescription")}
              placeholder={effective.description}
              band={SEO_LIMITS.ogDescription}
              multiline
              overridden={!!draft.ogDescription}
              onReset={reset("ogDescription")}
            />
            <SeoImageField
              label="Share image"
              helpText="Shown in link previews on Google, Facebook, iMessage, Slack, and X. 1200×630 recommended."
              value={text(draft.ogImageUrl)}
              onChange={(url) => onChange({ ogImageUrl: url })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Open Graph type</Label>
              <div>
                <Segmented
                  value={draft.ogType}
                  defaultLabel={`Default (${item.defaults.openGraphType})`}
                  options={[
                    { value: "website", label: "Website" },
                    { value: "article", label: "Article" },
                  ]}
                  onChange={(v) => onChange({ ogType: v })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="structured-data" className="text-xs font-medium text-foreground">
                Structured data (JSON-LD)
              </Label>
              {draft.structuredData != null ? (
                <button
                  type="button"
                  onClick={reset("structuredData")}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="self-center text-[11px] text-muted-foreground">Insert template:</span>
              {(["organization", "website", "breadcrumb", "faq", "product"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onChange({ structuredData: structuredDataTemplate(kind, siteOrigin) })}
                  className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] capitalize text-foreground transition-colors hover:bg-secondary"
                >
                  {kind}
                </button>
              ))}
            </div>
            <Textarea
              id="structured-data"
              rows={12}
              value={structuredDataText(draft.structuredData)}
              placeholder={'{ "@context": "https://schema.org", "@type": "WebPage" }'}
              onChange={(e) => onChange({ structuredData: e.target.value === "" ? null : e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Optional JSON-LD, rendered into this page&apos;s head for rich results. Site-wide
              Organization and search-box schema is already emitted automatically.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Google preview</p>
          <SerpPreview
            title={effective.title}
            description={effective.description}
            url={effective.canonical}
            siteOrigin={siteOrigin}
            faviconUrl={faviconUrl}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social preview</p>
          <SocialPreview
            title={effective.ogTitle}
            description={effective.ogDescription}
            imageUrl={effective.ogImageUrl}
            url={effective.canonical}
            siteOrigin={siteOrigin}
            card="summary_large_image"
          />
        </div>
        <div className="rounded-lg border border-border p-4">
          <SeoScore result={score} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <SeoSearchInsights pageKey={item.key} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <SeoHistory pageKey={item.key} onRestored={onRestored} />
        </div>
      </aside>
    </div>
  )
}

function RobotsToggle(props: {
  label: string
  hint: string
  value: boolean | null
  fallback: boolean
  onChange: (value: boolean | null) => void
}) {
  const { label, hint, value, fallback, onChange } = props
  const checked = typeof value === "boolean" ? value : fallback
  return (
    <div className="flex items-start gap-3">
      <Switch
        checked={checked}
        onCheckedChange={(next) => onChange(next === fallback ? null : next)}
      />
      <div className="leading-tight">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {value === null ? `Default: ${fallback ? "on" : "off"}` : hint}
        </p>
      </div>
    </div>
  )
}
