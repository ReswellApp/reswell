"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpRight, MapPin, Package, Store, UserCircle } from "lucide-react"
import type { DirectoryKind, DirectoryListEntry } from "@/lib/index-directory/types"
import { INDEX_DIRECTORY_BASE } from "@/lib/index-directory/routes"
import { cn } from "@/lib/utils"

const FILTERS: { id: "all" | DirectoryKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "brand", label: "Brands" },
  { id: "shaper", label: "Shapers" },
  { id: "storefront", label: "Storefronts" },
]

function profileHref(entry: DirectoryListEntry) {
  if (entry.kind === "brand") return `${INDEX_DIRECTORY_BASE}/brands/${entry.slug}`
  if (entry.kind === "shaper") return `${INDEX_DIRECTORY_BASE}/shapers/${entry.slug}`
  return `${INDEX_DIRECTORY_BASE}/storefronts/${entry.slug}`
}

export function DirectoryExplorer({ entries }: { entries: DirectoryListEntry[] }) {
  const [filter, setFilter] = useState<"all" | DirectoryKind>("all")

  const filtered = useMemo(() => {
    if (filter === "all") return entries
    return entries.filter((e) => e.kind === filter)
  }, [entries, filter])

  return (
    <section className="border-b border-border/80 bg-background" aria-labelledby="directory-heading">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Directory</p>
          <h2 id="directory-heading" className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Brands, shapers & storefronts
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Explore maker profiles, board families, and where they come from. More names will land here over time.
          </p>
        </div>

        <div
          className="mt-8 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter directory by type"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/80 bg-card text-foreground hover:border-foreground/30",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {filtered.length > 0 ? (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
              <li key={`${entry.kind}-${entry.slug}`}>
                <Link
                  href={profileHref(entry)}
                  className="group flex h-full flex-col rounded-xl border border-border/80 bg-card p-5 no-underline shadow-soft transition-all hover:border-foreground/25 hover:no-underline hover:shadow-soft-hover sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-background p-1.5">
                      <Image
                        src={entry.logoUrl}
                        alt={`${entry.name} logo`}
                        fill
                        className="object-contain object-center"
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {entry.kind === "brand" ? (
                          <Package className="h-3.5 w-3.5" aria-hidden />
                        ) : entry.kind === "shaper" ? (
                          <UserCircle className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Store className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {entry.kind === "brand" ? "Brand" : entry.kind === "shaper" ? "Shaper" : "Storefront"}
                      </div>
                      <h3 className="mt-1 font-semibold tracking-tight text-foreground">
                        {entry.name}
                      </h3>
                      {entry.locationLabel ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {entry.locationLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {entry.shortDescription}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
                    {entry.modelCount != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">{entry.modelCount} models</span>
                    ) : (
                      <span />
                    )}
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                      View profile
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-12 rounded-lg border border-dashed border-border/80 bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
            No profiles in this category yet. Check back soon or browse{" "}
            <span className="font-medium text-foreground">All</span>.
          </p>
        )}
      </div>
    </section>
  )
}
