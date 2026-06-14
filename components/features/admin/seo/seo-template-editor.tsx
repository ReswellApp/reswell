"use client"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { type ManagedPageSeoItem } from "@/lib/seo/types"
import { applySeoTemplate } from "@/lib/seo/apply-template"
import { SerpPreview } from "./serp-preview"
import { SocialPreview } from "./social-preview"

interface SeoTemplateEditorProps {
  item: ManagedPageSeoItem
  siteOrigin: string
}

function ReadOnlyField(props: { label: string; value: string }) {
  const { label, value } = props
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <p className="rounded-md border border-border bg-secondary/20 px-3 py-2 font-mono text-xs text-foreground">
        {value || "—"}
      </p>
    </div>
  )
}

/**
 * Read-only reference for dynamic page types (listings, brands, sellers). Templates live in
 * `lib/seo/dynamic-page-types.ts`.
 */
export function SeoTemplateEditor({ item, siteOrigin }: SeoTemplateEditorProps) {
  const vars = item.templateVars ?? []
  const sampleVars: Record<string, string> = Object.fromEntries(vars.map((v) => [v.token, v.sample]))

  const titleTpl = item.defaults.title
  const descTpl = item.defaults.description

  const previewTitle = applySeoTemplate(titleTpl, sampleVars)
  const previewDesc = applySeoTemplate(descTpl, sampleVars)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{item.label}</h2>
          <Badge variant="outline">Code template</Badge>
          <Badge variant="outline">Applies to all {item.label.toLowerCase()}</Badge>
        </div>
        {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}

        <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          Edit in <code className="text-foreground">lib/seo/dynamic-page-types.ts</code> (key:{" "}
          <code className="text-foreground">{item.key}</code>).
        </p>

        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs font-medium text-foreground">Variables</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <span
                key={v.token}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground"
              >
                <span className="font-mono">{`{${v.token}}`}</span>
                <span className="ml-1 text-muted-foreground">{v.label}</span>
              </span>
            ))}
          </div>
        </div>

        <ReadOnlyField label="Title template" value={titleTpl} />
        <ReadOnlyField label="Description template" value={descTpl} />
      </div>

      <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample preview</p>
          <SerpPreview
            title={previewTitle}
            description={previewDesc}
            url={item.defaults.path}
            siteOrigin={siteOrigin}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social preview</p>
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
