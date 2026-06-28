"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "latest", label: "Latest", href: "/threads" },
  { id: "top", label: "Top", href: "/threads?sort=top" },
  { id: "reviews", label: "Board reviews", href: "/threads/reviews" },
] as const

export function ThreadsSubNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = searchParams.get("sort")

  function isActive(tab: (typeof TABS)[number]): boolean {
    if (tab.id === "reviews") return pathname.startsWith("/threads/reviews")
    if (tab.id === "top") return pathname === "/threads" && sort === "top"
    return pathname === "/threads" && sort !== "top"
  }

  return (
    <nav
      aria-label="Threads sections"
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg bg-[#2d3744] p-1 text-sm shadow-sm",
        className,
      )}
    >
      {TABS.map((tab) => {
        const active = isActive(tab)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3.5 py-2 font-medium transition-colors",
              active
                ? "bg-white/15 text-white"
                : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
