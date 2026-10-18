"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import {
  boardBrowseNavItemIsActive,
  headerShopperNavItemIsActive,
  type CategoryLink,
  type HeaderShopperNavItem,
} from "@/lib/site-category-directory"
import { cn } from "@/lib/utils"

const menuContentClassName =
  "w-56 rounded-lg border-border p-1.5 shadow-lg [&_a]:!text-foreground [&_a:hover]:!text-foreground [&_a[data-highlighted]]:!text-foreground [&_a:focus]:!text-foreground"

const chipBase =
  "inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-[13px] font-semibold leading-tight shadow-sm transition-colors focus-visible:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-0"

function CategoryMenu({
  links,
  pathname,
  searchParams,
  align = "start",
  triggerClassName,
  trigger,
}: {
  links: CategoryLink[]
  pathname: string | null
  searchParams: Pick<URLSearchParams, "get">
  align?: "start" | "end"
  triggerClassName: string
  trigger: ReactNode
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={triggerClassName}>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} collisionPadding={8} className={menuContentClassName}>
        {links.map((link) => {
          const itemActive = boardBrowseNavItemIsActive(pathname, searchParams, link.href)
          return (
            <DropdownMenuItem key={`${link.href}-${link.label}`} asChild>
              <Link
                href={link.href}
                prefetch={boardsBrowseLinkPrefetch(link.href)}
                className={cn("w-full px-2.5 py-2 text-[15px]", itemActive && "font-medium")}
              >
                {link.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function HeaderShopperRailItem({
  item,
  pathname,
  searchParams,
}: {
  item: HeaderShopperNavItem
  pathname: string | null
  searchParams: URLSearchParams
}) {
  const active = headerShopperNavItemIsActive(pathname, searchParams, item)
  const isAnchor = item.href === "/boards"
  const menu = item.menu ?? []
  const labelClassName = cn(
    "cat-link text-[15px] transition-colors duration-smooth",
    isAnchor && "cat-link--anchor",
    active && "cat-link--active",
  )

  if (menu.length > 0 && item.menuOnly) {
    return (
      <CategoryMenu
        links={menu}
        pathname={pathname}
        searchParams={searchParams}
        triggerClassName="inline-flex shrink-0 items-center gap-1 border-0 bg-transparent py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart/25"
        trigger={
          <>
            <span className={labelClassName}>{item.label}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5", active ? "text-foreground" : "text-muted-foreground")}
              aria-hidden
            />
          </>
        }
      />
    )
  }

  if (menu.length > 0) {
    return (
      <span className="inline-flex shrink-0 items-center">
        <Link
          href={item.href}
          prefetch={boardsBrowseLinkPrefetch(item.href)}
          className={cn(labelClassName, "py-4")}
        >
          {item.label}
        </Link>
        <CategoryMenu
          links={menu}
          pathname={pathname}
          searchParams={searchParams}
          triggerClassName="inline-flex items-center border-0 bg-transparent py-4 pl-0.5 text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart/25 data-[state=open]:text-foreground"
          trigger={
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{item.label} menu</span>
            </>
          }
        />
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      prefetch={boardsBrowseLinkPrefetch(item.href)}
      className={cn(labelClassName, "shrink-0 py-4")}
    >
      {item.label}
    </Link>
  )
}

export function HeaderShopperChipItem({
  item,
  pathname,
  searchParams,
  compact = false,
}: {
  item: HeaderShopperNavItem
  pathname: string | null
  searchParams: URLSearchParams
  compact?: boolean
}) {
  const active = headerShopperNavItemIsActive(pathname, searchParams, item)
  const menu = item.menu ?? []
  const chipClassName = cn(
    chipBase,
    compact && "min-h-8 px-3 py-1 text-xs",
    active
      ? "border-foreground bg-muted text-foreground"
      : "border-border bg-background text-foreground hover:border-midgray/35",
  )

  if (menu.length > 0 && !item.menuOnly) {
    return (
      <span className="inline-flex items-stretch">
        <Link
          href={item.href}
          prefetch={boardsBrowseLinkPrefetch(item.href)}
          className={cn(chipClassName, "rounded-l-full rounded-r-none pr-2.5")}
        >
          {item.label}
        </Link>
        <CategoryMenu
          links={menu}
          pathname={pathname}
          searchParams={searchParams}
          triggerClassName={cn(
            chipClassName,
            "rounded-l-none rounded-r-full border-l-0 px-2",
          )}
          trigger={
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{item.label} menu</span>
            </>
          }
        />
      </span>
    )
  }

  if (menu.length > 0) {
    return (
      <CategoryMenu
        links={menu}
        pathname={pathname}
        searchParams={searchParams}
        triggerClassName={chipClassName}
        trigger={
          <>
            {item.label}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </>
        }
      />
    )
  }

  return (
    <Link
      href={item.href}
      prefetch={boardsBrowseLinkPrefetch(item.href)}
      className={chipClassName}
    >
      {item.label}
    </Link>
  )
}
