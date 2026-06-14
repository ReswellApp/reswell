"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { type ManagedPageSeoItem } from "@/lib/seo/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SeoPageList } from "./seo-page-list"
import { SeoEditor } from "./seo-editor"
import { SeoTemplateEditor } from "./seo-template-editor"
import { SeoHealthOverview } from "./seo-health-overview"
import { RedirectsManager } from "./redirects-manager"
import { CrawlingManager } from "./crawling-manager"
import { summarizeSeoHealth } from "./seo-scoring"

interface SeoAdminClientProps {
  initialItems: ManagedPageSeoItem[]
  siteOrigin: string
}

export function SeoAdminClient({ initialItems, siteOrigin }: SeoAdminClientProps) {
  const [items] = useState<ManagedPageSeoItem[]>(initialItems)
  const [selectedKey, setSelectedKey] = useState<string | null>(initialItems[0]?.key ?? null)
  const [query, setQuery] = useState("")

  const itemByKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const selected = selectedKey ? itemByKey.get(selectedKey) ?? null : null

  const healthSummary = useMemo(() => summarizeSeoHealth(items), [items])

  return (
    <Tabs defaultValue="metadata" className="space-y-4">
      <TabsList>
        <TabsTrigger value="metadata">Page metadata</TabsTrigger>
        <TabsTrigger value="redirects">Redirects</TabsTrigger>
        <TabsTrigger value="crawling">Crawling</TabsTrigger>
      </TabsList>

      <TabsContent value="metadata" className="space-y-4">
        <SeoHealthOverview summary={healthSummary} onSelectPage={setSelectedKey} />

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-lg border border-border lg:h-[calc(100vh-9rem)] lg:sticky lg:top-4">
            <SeoPageList
              items={items}
              query={query}
              onQueryChange={setQuery}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>

          <div className="min-w-0">
            {selected ? (
              selected.kind === "dynamic" ? (
                <SeoTemplateEditor item={selected} siteOrigin={siteOrigin} />
              ) : (
                <SeoEditor item={selected} siteOrigin={siteOrigin} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
                <Search className="h-8 w-8" aria-hidden />
                <p className="text-sm">Select a page to view its SEO.</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="redirects">
        <RedirectsManager />
      </TabsContent>

      <TabsContent value="crawling">
        <CrawlingManager siteOrigin={siteOrigin} />
      </TabsContent>
    </Tabs>
  )
}
