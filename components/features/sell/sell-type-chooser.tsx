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
      href: "/sell/fins?step=search&new=1",
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
    variant === "panel"
      ? "rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      : "text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <div
      className={cn(
        variant === "page" ? "space-y-3 text-center" : "space-y-2.5",
        className,
      )}
    >
      <p
        className={cn(
          "text-muted-foreground",
          variant === "page" ? "text-sm" : "text-xs",
        )}
      >
        {variant === "page" ? "Or list by type" : "Or pick a type"}
      </p>
      <nav
        aria-label="List by product type"
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "page" && "justify-center gap-x-1 gap-y-2",
        )}
      >
        {options.map((option, index) => (
          <span key={option.title} className="inline-flex items-center gap-1">
            {variant === "page" && index > 0 ? (
              <span className="px-1.5 text-muted-foreground/35" aria-hidden>
                ·
              </span>
            ) : null}
            <Link href={option.href} className={linkClass}>
              {option.title}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  )
}
