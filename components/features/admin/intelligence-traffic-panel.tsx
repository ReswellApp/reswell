import Link from "next/link"

import type { IntelligenceTopPath } from "@/lib/types/businessIntelligence"
import { formatCount } from "@/components/features/admin/intelligence-format"

export function IntelligenceTrafficPanel({
  pages,
  source,
}: {
  pages: IntelligenceTopPath[]
  source: "ga4" | "none"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-headline text-base font-semibold">Most clicked URLs</h3>
        <p className="text-xs text-muted-foreground">
          {source === "ga4"
            ? "GA4 page views · last 28 days"
            : "Connect GA4 to rank site URLs by clicks and views"}
        </p>
      </div>
      {pages.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No page-view data for this window.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {pages.map((page, index) => (
            <li key={`${page.path}-${index}`} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <Link
                  href={page.path}
                  className="block truncate text-sm font-medium hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {page.path}
                </Link>
                {page.title ? (
                  <p className="truncate text-xs text-muted-foreground">{page.title}</p>
                ) : null}
              </div>
              <div className="text-right text-xs tabular-nums text-muted-foreground">
                <p className="font-semibold text-foreground">{formatCount(page.views)} views</p>
                {page.sessions != null ? <p>{formatCount(page.sessions)} sessions</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
