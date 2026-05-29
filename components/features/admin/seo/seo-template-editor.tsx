"use client"

import { useRef, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { type ManagedPageSeoItem, type PageSeoOverrideValues } from "@/lib/seo/types"
import { applySeoTemplate } from "@/lib/seo/apply-template"
import { FieldCounter } from "./field-counter"
import { SerpPreview } from "./serp-preview"
import { SocialPreview } from "./social-preview"
import { SEO_LIMITS } from "./seo-scoring"

interface SeoTemplateEditorProps {
  item: ManagedPageSeoItem
  draft: PageSeoOverrideValues
  onChange: (patch: Partial<PageSeoOverrideValues>) => void
  siteOrigin: string
  faviconUrl?: string | null
}

/**
 * Editor for dynamic page *types* (listings, brands, sellers). Title/description are templates
 * with {token} variables; the live preview substitutes example values so the admin sees a
 * realistic snippet.
 */
export function SeoTemplateEditor({ item, draft, onChange, siteOrigin, faviconUrl }: SeoTemplateEditorProps) {
  const vars = item.templateVars ?? []
  const sampleVars: Record<string, string> = Object.fromEntries(vars.map((v) => [v.token, v.sample]))

  const titleTpl = draft.title ?? item.defaults.title
  const descTpl = draft.description ?? item.defaults.description

  const previewTitle = applySeoTemplate(titleTpl, sampleVars)
  const previewDesc = applySeoTemplate(descTpl, sampleVars)

  const lastFocused = useRef<"title" | "description">("title")
  const [lastInserted, setLastInserted] = useState<string | null>(null)

  function insertToken(token: string) {
    const target = lastFocused.current
    const current = (target === "title" ? draft.title : draft.description) ?? item.defaults[target]
    const next = `${current}{${token}}`
    onChange({ [target]: next } as Partial<PageSeoOverrideValues>)
    setLastInserted(token)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{item.label}</h2>
          {item.customized ? <Badge variant="secondary">Custom template</Badge> : <Badge variant="outline">Default</Badge>}
          <Badge variant="outline">Applies to all {item.label.toLowerCase()}</Badge>
        </div>
        {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}

        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium text-foreground">Variables — click to insert</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertToken(v.token)}
                title={`Example: ${v.sample}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  lastInserted === v.token
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                <span className="font-mono">{`{${v.token}}`}</span>
                <span className="ml-1 text-muted-foreground">{v.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Missing values are dropped automatically — no empty separators.
          </p>
        </div>

        <FieldCounter
          id="tpl-title"
          label="Title template"
          value={draft.title ?? ""}
          placeholder={item.defaults.title}
          band={SEO_LIMITS.title}
          overridden={draft.title != null}
          onChange={(v) => onChange({ title: v === "" ? null : v })}
          onReset={() => onChange({ title: null })}
          onFocus={() => (lastFocused.current = "title")}
        />

        <FieldCounter
          id="tpl-description"
          label="Description template"
          value={draft.description ?? ""}
          placeholder={item.defaults.description}
          band={SEO_LIMITS.description}
          multiline
          overridden={draft.description != null}
          onChange={(v) => onChange({ description: v === "" ? null : v })}
          onReset={() => onChange({ description: null })}
          onFocus={() => (lastFocused.current = "description")}
        />

        <div className="flex flex-wrap gap-6 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-index"
              checked={draft.robotsIndex !== false}
              onCheckedChange={(c) => onChange({ robotsIndex: c ? null : false })}
            />
            <Label htmlFor="tpl-index" className="text-xs text-foreground">
              Allow indexing
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-follow"
              checked={draft.robotsFollow !== false}
              onCheckedChange={(c) => onChange({ robotsFollow: c ? null : false })}
            />
            <Label htmlFor="tpl-follow" className="text-xs text-foreground">
              Follow links
            </Label>
          </div>
          {(draft.robotsIndex === false || draft.robotsFollow === false) ? (
            <button
              type="button"
              onClick={() => onChange({ robotsIndex: null, robotsFollow: null })}
              className="inline-flex items-center gap-1 self-center text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sample preview
          </p>
          <SerpPreview
            title={previewTitle}
            description={previewDesc}
            url={item.defaults.path}
            siteOrigin={siteOrigin}
            faviconUrl={faviconUrl}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Social preview
          </p>
          <SocialPreview
            title={previewTitle}
            description={previewDesc}
            imageUrl={null}
            url={item.defaults.path}
            siteOrigin={siteOrigin}
            card="summary_large_image"
          />
          <p className="text-[11px] text-muted-foreground">
            Each {item.label.toLowerCase().replace(/s$/, "")} uses its own photo for the share image.
          </p>
        </div>
      </aside>
    </div>
  )
}
