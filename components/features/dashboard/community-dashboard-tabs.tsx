"use client"

import { Suspense, useCallback, type ReactNode } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"

export type CommunityDashboardTab = "following" | "followers"

function tabFromSearchParams(searchParams: URLSearchParams): CommunityDashboardTab {
  return searchParams.get("tab") === "followers" ? "followers" : "following"
}

function TabsFallback() {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md bg-muted px-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      Loading…
    </div>
  )
}

function CommunityDashboardTabsInner({
  followingPanel,
  followersPanel,
}: {
  followingPanel: ReactNode
  followersPanel: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = tabFromSearchParams(searchParams)

  const onValueChange = useCallback(
    (next: string) => {
      const v = next as CommunityDashboardTab
      const params = new URLSearchParams(searchParams.toString())
      if (v === "followers") {
        params.set("tab", "followers")
      } else {
        params.delete("tab")
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="following">Following</TabsTrigger>
        <TabsTrigger value="followers">Followers</TabsTrigger>
      </TabsList>
      <TabsContent value="following" className="mt-6 focus-visible:ring-0">
        {followingPanel}
      </TabsContent>
      <TabsContent value="followers" className="mt-6 focus-visible:ring-0">
        {followersPanel}
      </TabsContent>
    </Tabs>
  )
}

export function CommunityDashboardTabs({
  followingPanel,
  followersPanel,
}: {
  followingPanel: ReactNode
  followersPanel: ReactNode
}) {
  return (
    <Suspense fallback={<TabsFallback />}>
      <CommunityDashboardTabsInner followingPanel={followingPanel} followersPanel={followersPanel} />
    </Suspense>
  )
}
