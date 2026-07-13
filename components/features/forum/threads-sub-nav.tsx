"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BoardTalkSearch } from "@/components/forum/board-talk-search"
import { threadsSurfaceClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

const LEFT_TABS = [
  { id: "latest", label: "Latest", href: "/threads" },
  { id: "top", label: "Top", href: "/threads?sort=top" },
] as const

const REVIEWS_TAB = { id: "reviews", label: "Board reviews", href: "/threads/reviews" } as const

const tabLinkClassName = (active: boolean) =>
  cn(
    "rounded-md px-3.5 py-2 font-medium transition-colors",
    active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
  )

export function ThreadsSubNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = searchParams.get("sort")
  const q = searchParams.get("q")?.trim() ?? ""

  function isLeftTabActive(tab: (typeof LEFT_TABS)[number]): boolean {
    if (tab.id === "top") return pathname === "/threads" && sort === "top"
    return pathname === "/threads" && sort !== "top"
  }

  const reviewsActive = pathname.startsWith("/threads/reviews")

  return (
    <nav
      aria-label="Threads sections"
      className={cn(
        "flex flex-col gap-2 rounded-lg p-2 text-sm shadow-sm sm:flex-row sm:items-center sm:gap-3",
        threadsSurfaceClassName,
        className,
      )}
    >
      <div className="w-full min-w-0 sm:order-2 sm:flex-1 sm:basis-[12rem] sm:px-1">
        <BoardTalkSearch
          defaultValue={q}
          embedded
          className="w-full"
          placeholder="Search topics and replies…"
        />
      </div>

      {/* Mobile: all section links in one row below search */}
      <div className="flex flex-wrap items-center gap-1 sm:hidden">
        {LEFT_TABS.map((tab) => {
          const active = isLeftTabActive(tab)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={tabLinkClassName(active)}
            >
              {tab.label}
            </Link>
          )
        })}
        <Link
          href={REVIEWS_TAB.href}
          aria-current={reviewsActive ? "page" : undefined}
          className={tabLinkClassName(reviewsActive)}
        >
          {REVIEWS_TAB.label}
        </Link>
      </div>

      {/* Desktop: Latest / Top | search | Board reviews */}
      <div className="hidden shrink-0 items-center gap-1 sm:order-1 sm:flex">
        {LEFT_TABS.map((tab) => {
          const active = isLeftTabActive(tab)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={tabLinkClassName(active)}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <Link
        href={REVIEWS_TAB.href}
        aria-current={reviewsActive ? "page" : undefined}
        className={cn("hidden shrink-0 sm:order-3 sm:inline-flex", tabLinkClassName(reviewsActive))}
      >
        {REVIEWS_TAB.label}
      </Link>
    </nav>
  )
}
