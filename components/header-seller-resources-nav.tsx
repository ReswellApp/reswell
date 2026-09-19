"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  sellerResourcesNavIsActive,
  sellerResourcesNavItemIsActive,
  sellerResourcesNavLinks,
} from "@/lib/site-category-directory"
import { cn } from "@/lib/utils"

const chipTriggerClassName =
  "inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-[13px] font-semibold leading-tight text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-0"

export function HeaderSellerResourcesNav({
  pathname,
  className,
  variant = "header",
  compact = false,
}: {
  pathname: string | null
  className?: string
  variant?: "header" | "chip"
  compact?: boolean
}) {
  const active = sellerResourcesNavIsActive(pathname)
  const isChip = variant === "chip"

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "group shrink-0 cursor-pointer",
          isChip
            ? cn(
                chipTriggerClassName,
                compact && "min-h-8 px-3 py-1 text-xs",
                active
                  ? "border-foreground bg-muted font-semibold"
                  : "border-border bg-background hover:border-midgray/35",
                "data-[state=open]:border-foreground data-[state=open]:bg-muted",
              )
            : cn(
                "flex items-center gap-1 whitespace-nowrap border-0 bg-transparent text-[15px] transition-colors duration-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart/25",
                active
                  ? "rounded-full bg-listingHeart/10 py-1.5 pl-3 pr-2.5 font-medium text-listingHeart"
                  : "py-4 text-muted-foreground hover:text-foreground",
                "data-[state=open]:rounded-full data-[state=open]:bg-listingHeart/10 data-[state=open]:py-1.5 data-[state=open]:pl-3 data-[state=open]:pr-2.5 data-[state=open]:font-medium data-[state=open]:text-listingHeart",
              ),
          className,
        )}
      >
        Seller Resources
        <ChevronDown
          className={cn(
            "shrink-0 transition-transform group-data-[state=open]:rotate-180",
            isChip ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="w-56 rounded-lg border-border p-1.5 shadow-lg [&_a]:!text-foreground [&_a:hover]:!text-foreground [&_a[data-highlighted]]:!text-foreground"
      >
        {sellerResourcesNavLinks.map((item) => {
          const itemActive = sellerResourcesNavItemIsActive(pathname, item.href)
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn("w-full px-2.5 py-2 text-[15px]", itemActive && "font-medium")}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
