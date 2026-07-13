"use client"

import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { ThreadsSubNav } from "@/components/features/forum/threads-sub-nav"
import { ThreadsHubToolbar } from "@/components/features/forum/threads-hub-panels"
import { ThreadsRouteBreadcrumbs } from "@/components/features/forum/threads-breadcrumb-provider"
import { threadsSurfaceMutedClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type ThreadsSubheaderProps = {
  onNewTopic: () => void
  className?: string
}

function SubNavFallback() {
  return <div className={cn("h-11 rounded-lg animate-pulse", threadsSurfaceMutedClassName)} aria-hidden />
}

export function ThreadsSubheader({ onNewTopic, className }: ThreadsSubheaderProps) {
  const pathname = usePathname()
  const isProfilePage = pathname === "/threads/profile"
  const isMessagesPage = pathname === "/threads/messages"
  const isUtilityPage = isProfilePage || isMessagesPage

  if (isUtilityPage) {
    return (
      <header
        className={cn("mb-6", className)}
        aria-label={isProfilePage ? "Threads profile" : "Threads messages"}
      >
        <Suspense fallback={null}>
          <ThreadsRouteBreadcrumbs />
        </Suspense>
      </header>
    )
  }

  return (
    <header className={cn("mb-6 space-y-4 sm:space-y-5", className)} aria-label="Threads">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Threads</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Community discussions — read everything, jump in when you&apos;re ready.
        </p>
      </div>

      <Suspense fallback={null}>
        <ThreadsRouteBreadcrumbs />
      </Suspense>

      <Suspense fallback={<SubNavFallback />}>
        <ThreadsSubNav />
      </Suspense>

      <ThreadsHubToolbar onNewTopic={onNewTopic} />
    </header>
  )
}
