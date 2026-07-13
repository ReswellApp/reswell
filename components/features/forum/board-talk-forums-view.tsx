"use client"

import Link from "next/link"
import { PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ThreadsMostActivePanel,
  ThreadsTopicTable,
} from "@/components/features/forum/threads-hub-panels"
import { ThreadsActivePresencePanel } from "@/components/features/forum/threads-active-presence-panel"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { useBoardTalkForumsUi } from "@/components/features/forum/board-talk-forums-ui-context"
import type { BoardTalkForumThread } from "@/lib/services/forumThreads"

type BoardTalkForumsViewProps = {
  threads: BoardTalkForumThread[]
  searchQuery: string
  isLoggedIn: boolean
}

export function BoardTalkForumsView({ threads, searchQuery, isLoggedIn }: BoardTalkForumsViewProps) {
  const authModal = useAuthModal()
  const forumsUi = useBoardTalkForumsUi()
  const q = searchQuery.trim()
  const isSearching = q.length > 0

  function handleNewTopic() {
    if (isLoggedIn) {
      forumsUi?.openNewThread()
      return
    }
    authModal.openLogin("/threads")
  }

  return (
    <div className="space-y-5">
      {isSearching ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {threads.length} topic{threads.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
          </p>
          <Button variant="ghost" size="sm" asChild className="rounded-md">
            <Link href="/threads">Clear search</Link>
          </Button>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/80 px-6 py-16 text-center">
          <p className="text-lg font-medium text-foreground">
            {isSearching ? "No topics match that search." : "No topics yet — start the conversation."}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {isSearching
              ? "Try different words or browse all topics."
              : "Ask about boards, share a session report, or post a link."}
          </p>
          {isSearching ? (
            <Button variant="outline" asChild className="mt-6 rounded-md">
              <Link href="/threads">View all topics</Link>
            </Button>
          ) : (
            <Button type="button" className="mt-6 rounded-md" onClick={handleNewTopic}>
              <PenLine className="mr-2 h-4 w-4" />
              {isLoggedIn ? "Create the first topic" : "Sign in to post"}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start">
          <ThreadsTopicTable threads={threads} />
          {!isSearching ? (
            <div className="space-y-4 lg:sticky lg:top-24">
              <ThreadsMostActivePanel threads={threads} />
              <ThreadsActivePresencePanel />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
