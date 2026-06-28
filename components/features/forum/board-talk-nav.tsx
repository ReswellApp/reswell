"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type BoardTalkTab = "forums" | "reviews"

const BOARD_TALK_TABS: { id: BoardTalkTab; label: string; href: string }[] = [
  { id: "forums", label: "Forums", href: "/threads" },
  { id: "reviews", label: "Board Reviews", href: "/threads/reviews" },
]

function tabFromPathname(pathname: string | null): BoardTalkTab | null {
  if (!pathname) return null
  if (pathname === "/threads" || pathname === "/threads/") return "forums"
  if (pathname.startsWith("/threads/reviews")) return "reviews"
  return null
}

export function getBoardTalkTab(pathname: string | null): BoardTalkTab | null {
  return tabFromPathname(pathname)
}

export function isBoardTalkHubPath(pathname: string | null): boolean {
  return tabFromPathname(pathname) !== null
}

export function BoardTalkNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const activeTab = tabFromPathname(pathname)

  return (
    <nav aria-label="Threads sections" className={cn("flex flex-wrap gap-2", className)}>
      {BOARD_TALK_TABS.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-touch items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground bg-foreground text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
