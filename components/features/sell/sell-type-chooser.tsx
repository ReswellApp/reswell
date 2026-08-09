"use client"

import Link from "next/link"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { cn } from "@/lib/utils"

/** Search-first sell hub (preserves `?new=1` for analytics / blank-slate). */
export const SELL_HUB_HREF = "/sell?new=1"

/** Canonical surfboard create URL (full wizard — Quick list is retired). */
export const SELL_SURFBOARD_PATH_HREF = "/sell/boards?new=1"

type SellTypeOption = {
  href: string
  title: string
  /** When true, only shown to marketplace admins. */
  adminOnly?: boolean
}

/** Product types available from the sell hub “list by type” row. */
const SELL_TYPE_OPTIONS: readonly SellTypeOption[] = [
  {
    href: SELL_SURFBOARD_PATH_HREF,
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

function sellTypeOptions(isAdmin: boolean): readonly SellTypeOption[] {
  return SELL_TYPE_OPTIONS.filter((option) => !option.adminOnly || isAdmin)
}

/**
 * Compact type links under catalog search (and in empty-result panels).
 */
export function SellListByTypeLinks({
  isAdmin = false,
  variant = "page",
  className,
}: {
  isAdmin?: boolean
  variant?: "page" | "panel"
  className?: string
}) {
  const options = sellTypeOptions(isAdmin)
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
