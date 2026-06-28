"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { ThreadsBreadcrumbs, type ThreadsCrumb } from "@/components/features/forum/threads-breadcrumbs"
import { capitalizeWords } from "@/lib/listing-labels"

type ThreadsBreadcrumbContextValue = {
  setPageLabel: (label: string | null) => void
}

const ThreadsBreadcrumbContext = createContext<ThreadsBreadcrumbContextValue | null>(null)

export function ThreadsBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [pageLabel, setPageLabel] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setPageLabel(null)
  }, [pathname])

  const value = useMemo(() => ({ setPageLabel }), [])

  return (
    <ThreadsBreadcrumbContext.Provider value={value}>
      <ThreadsRouteBreadcrumbs pageLabel={pageLabel} />
      {children}
    </ThreadsBreadcrumbContext.Provider>
  )
}

export function useThreadsPageLabel(label: string | null | undefined) {
  const ctx = useContext(ThreadsBreadcrumbContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setPageLabel(label?.trim() ? label.trim() : null)
    return () => ctx.setPageLabel(null)
  }, [ctx, label])
}

function ThreadsRouteBreadcrumbs({ pageLabel }: { pageLabel: string | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items = useMemo((): ThreadsCrumb[] => {
    if (!pathname?.startsWith("/threads")) return []

    if (pathname === "/threads" || pathname === "/threads/") {
      const sort = searchParams.get("sort")
      const q = searchParams.get("q")?.trim()
      if (q) {
        return [{ label: "Threads", href: "/threads" }, { label: `Search: ${q}` }]
      }
      if (sort === "top") {
        return [{ label: "Threads", href: "/threads" }, { label: "Top" }]
      }
      return [{ label: "Threads" }]
    }

    if (pathname === "/threads/reviews") {
      return [{ label: "Threads", href: "/threads" }, { label: "Board reviews" }]
    }

    if (pathname === "/threads/new") {
      return [{ label: "Threads", href: "/threads" }, { label: "New topic" }]
    }

    if (pathname.startsWith("/threads/")) {
      const slug = pathname.slice("/threads/".length).split("/")[0]
      const fallback = slug ? capitalizeWords(slug.replace(/-/g, " ")) : "Topic"
      return [
        { label: "Threads", href: "/threads" },
        { label: pageLabel ?? fallback },
      ]
    }

    return [{ label: "Threads" }]
  }, [pathname, pageLabel, searchParams])

  if (items.length === 0) return null

  return <ThreadsBreadcrumbs items={items} />
}
