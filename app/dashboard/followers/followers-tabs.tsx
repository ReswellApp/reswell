"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Rss, Users } from "lucide-react"

type FollowersTabsProps = {
  followingPanel: ReactNode
  followersPanel: ReactNode
}

export function FollowersTabs({ followingPanel, followersPanel }: FollowersTabsProps) {
  return (
    <Tabs defaultValue="followers" className="w-full space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="followers" className="gap-1.5">
          <Users className="h-4 w-4 shrink-0" />
          Your followers
        </TabsTrigger>
        <TabsTrigger value="following" className="gap-1.5">
          <Rss className="h-4 w-4 shrink-0" />
          Following
        </TabsTrigger>
      </TabsList>
      <TabsContent value="following" className="mt-0 space-y-6">
        {followingPanel}
      </TabsContent>
      <TabsContent value="followers" className="mt-0 space-y-6">
        {followersPanel}
      </TabsContent>
    </Tabs>
  )
}
