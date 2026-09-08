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

export function HeaderSellerResourcesNav({
  pathname,
  className,
}: {
  pathname: string | null
  className?: string
}) {
  const active = sellerResourcesNavIsActive(pathname)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "group flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap border-0 bg-transparent text-[15px] transition-colors duration-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart/25",
          active
            ? "rounded-full bg-listingHeart/10 py-1.5 pl-3 pr-2.5 font-medium text-listingHeart"
            : "py-4 text-muted-foreground hover:text-foreground",
          "data-[state=open]:rounded-full data-[state=open]:bg-listingHeart/10 data-[state=open]:py-1.5 data-[state=open]:pl-3 data-[state=open]:pr-2.5 data-[state=open]:font-medium data-[state=open]:text-listingHeart",
          className,
        )}
      >
        Seller Resources
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
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
