"use client"

import Link from "next/link"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import {
  SURFBOARD_SELL_BOARDS_CREATE_HREF,
  SURFBOARD_SELL_QUICK_CREATE_HREF,
} from "@/lib/sell-flow/surfboard-sell-paths"
import { cn } from "@/lib/utils"

/** Search-first sell hub (preserves `?new=1` for analytics / blank-slate). */
export const SELL_HUB_HREF = "/sell?new=1"

/** Returning-publisher default — Guided / Advanced boards form. */
export const SELL_SURFBOARD_PATH_HREF = SURFBOARD_SELL_BOARDS_CREATE_HREF
/** @deprecated Prefer SELL_SURFBOARD_PATH_HREF — same destination. */
export const SELL_SURFBOARD_FULL_PATH_HREF = SELL_SURFBOARD_PATH_HREF
/** First-time / guest default — Quick List (also reachable via view-mode picker). */
export const SELL_SURFBOARD_QUICK_PATH_HREF = SURFBOARD_SELL_QUICK_CREATE_HREF

type SellTypeOption = {
  href: string
  title: string
  /** When true, only shown to marketplace admins. */
  adminOnly?: boolean
}

/** Product types available from the sell hub “list by type” row (surfboard href injected). */
function sellTypeOptions(
  isAdmin: boolean,
  surfboardHref: string,
): readonly SellTypeOption[] {
  const options: readonly SellTypeOption[] = [
    {
      href: surfboardHref,
      title: "Surfboard",
    },
    {
      href: "/sell/fins?new=1",
      title: "Fins",
    },
    {
      href: "/sell/wetsuits?new=1",
      title: "Wetsuits",
    },
    {
      href: "/sell/magazines?new=1",
      title: "Magazines",
    },
    {
      href: "/sell/apparel?new=1",
      title: "Apparel",
      adminOnly: APPAREL_SELL_ADMIN_ONLY,
    },
  ]
  return options.filter((option) => !option.adminOnly || isAdmin)
}

/**
 * Compact type links between catalog search and trending brands
 * (and in empty-result panels).
 */
export function SellListByTypeLinks({
  isAdmin = false,
  surfboardHref = SELL_SURFBOARD_PATH_HREF,
  variant = "page",
  className,
}: {
  isAdmin?: boolean
  /** Experience-based default from {@link resolveDefaultSurfboardSellCreatePath}. */
  surfboardHref?: string
  variant?: "page" | "panel"
  className?: string
}) {
  const options = sellTypeOptions(isAdmin, surfboardHref)
  const linkClass =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3 text-sm font-medium text-foreground transition-all hover:border-foreground/40 hover:bg-muted/50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:h-10 sm:border-foreground/20 sm:px-3.5"

  return (
    <div className={cn(variant === "panel" && "space-y-2", className)}>
      {variant === "panel" ? (
        <p className="text-xs text-muted-foreground">Or pick a type</p>
      ) : null}
      <nav
        aria-label="List by product type"
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "page" ? "justify-start" : undefined,
        )}
      >
        {options.map((option) => (
          <Link key={option.title} href={option.href} className={linkClass}>
            {option.title}
          </Link>
        ))}
      </nav>
    </div>
  )
}
