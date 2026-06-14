"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { defaultsToEffectivePageSeo, type ManagedPageSeoItem } from "@/lib/seo/types"
import { SerpPreview } from "./serp-preview"
import { SocialPreview } from "./social-preview"
import { SeoScore } from "./seo-score"
import { SeoSearchInsights } from "./seo-search-insights"
import { scorePageSeo } from "./seo-scoring"

interface SeoEditorProps {
  item: ManagedPageSeoItem
  siteOrigin: string
}

function ReadOnlyField(props: { label: string; value: string; mono?: boolean }) {
  const { label, value, mono } = props
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <p className={mono ? "rounded-md border border-border bg-secondary/20 px-3 py-2 font-mono text-xs text-foreground" : "rounded-md border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground"}>
        {value || "—"}
      </p>
    </div>
  )
}

export function SeoEditor({ item, siteOrigin }: SeoEditorProps) {
  const effective = defaultsToEffectivePageSeo(item.defaults)
  const score = scorePageSeo(effective)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{item.label}</h2>
          <Badge variant="outline">Code default</Badge>
          {!effective.robotsIndex ? <Badge variant="destructive">No-index</Badge> : null}
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

        <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          Edit in <code className="text-foreground">lib/seo/managed-pages.ts</code> (key:{" "}
          <code className="text-foreground">{item.key}</code>).
        </p>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-2">
            <ReadOnlyField label="Meta title" value={effective.title} />
            <ReadOnlyField label="Meta description" value={effective.description} />
            <ReadOnlyField
              label="Keywords"
              value={effective.keywords.length > 0 ? effective.keywords.join(", ") : ""}
            />
            <ReadOnlyField label="Canonical URL" value={effective.canonical} mono />
            <div className="flex flex-wrap gap-6 rounded-md border border-border p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground">Indexable</p>
                <p className="text-muted-foreground">{effective.robotsIndex ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Follow links</p>
                <p className="text-muted-foreground">{effective.robotsFollow ? "Yes" : "No"}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4 pt-2">
            <ReadOnlyField label="Open Graph title" value={effective.ogTitle} />
            <ReadOnlyField label="Open Graph description" value={effective.ogDescription} />
            <ReadOnlyField label="Share image URL" value={effective.ogImageUrl ?? ""} mono />
            <ReadOnlyField label="Open Graph type" value={effective.ogType} />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-2 pt-2">
            <ReadOnlyField
              label="Structured data (JSON-LD)"
              value={
                effective.structuredData != null
                  ? typeof effective.structuredData === "string"
                    ? effective.structuredData
                    : JSON.stringify(effective.structuredData, null, 2)
                  : ""
              }
              mono
            />
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
      </aside>
    </div>
  )
}
