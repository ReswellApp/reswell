"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import type { ConsignmentStoreStaffRole } from "@/lib/types/consignment"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  buildStoreNavSections,
  filterStoreNavSections,
  storeNavHref,
} from "@/lib/store-nav-links"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"
import {
  dashboardMobileSectionTitleClass,
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

function isStoreLinkActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const target = href.replace(/\/$/, "") || "/"
  if (target.endsWith("/dashboard") || target.endsWith("/account")) {
    return normalized === target
  }
  if (target.endsWith("/messages") || target.endsWith("/account/messages")) {
    return normalized === target || normalized.startsWith(`${target}/`)
  }
  return normalized === target || normalized.startsWith(`${target}/`)
}

export interface StoreMobileChromeProps {
  slug: string
  storeName: string
  role: ConsignmentStoreStaffRole
}

export function StoreMobileChrome({ slug, storeName, role }: StoreMobileChromeProps) {
  const pathname = usePathname() ?? ""
  const [open, setOpen] = useState(false)
  const { sectionName, description } = resolveStoreSectionMeta(pathname, slug)

  const flatLinks = useMemo(() => {
    return filterStoreNavSections(buildStoreNavSections(), role).flatMap((section) =>
      section.items.map((item) => ({
        ...item,
        href: storeNavHref(slug, item.path),
        section: section.label,
      })),
    )
  }, [role, slug])

  const activeLink =
    flatLinks.find((link) => isStoreLinkActive(pathname, link.href)) ?? flatLinks[0]

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="space-y-5 pt-4 lg:hidden">
      <h1 className={dashboardPageTitleClass}>{storeName}</h1>

      <nav className="lg:hidden" aria-label="Store sections">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
              >
                <span>{activeLink?.name ?? "Store menu"}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    open && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-2 py-2">
                {flatLinks.map((link) => {
                  const active = isStoreLinkActive(pathname, link.href)
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {link.name}
                    </Link>
                  )
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </nav>

      <header className="space-y-2 border-b border-border/60 pb-5">
        <h2 className={dashboardMobileSectionTitleClass}>{sectionName}</h2>
        <p className={cn(dashboardPageSubtitleClass, "mt-0")}>{description}</p>
      </header>
    </div>
  )
}
