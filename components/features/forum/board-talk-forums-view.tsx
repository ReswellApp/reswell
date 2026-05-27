import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Heart, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { capitalizeWords } from "@/lib/listing-labels"
import type { BoardTalkForumThread } from "@/lib/services/forumThreads"
import { BoardTalkSearch } from "@/components/forum/board-talk-search"

type BoardTalkForumsViewProps = {
  threads: BoardTalkForumThread[]
  searchQuery: string
  isLoggedIn: boolean
}

export function BoardTalkForumsView({ threads, searchQuery, isLoggedIn }: BoardTalkForumsViewProps) {
  const q = searchQuery.trim()

  return (
    <>
      <BoardTalkSearch defaultValue={q} />

      {q ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {threads.length} post{threads.length !== 1 ? "s" : ""} found for &ldquo;{q}&rdquo;
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/board-talk">Clear</Link>
          </Button>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <Card className="mt-10 sm:mt-12">
          <CardContent className="px-6 py-14 text-center text-muted-foreground sm:px-8">
            <p>{q ? "No posts match your search." : "No posts yet."}</p>
            {q ? (
              <Button variant="outline" asChild className="mt-6">
                <Link href="/board-talk">View all posts</Link>
              </Button>
            ) : isLoggedIn ? (
              <Button asChild className="mt-6">
                <Link href="/board-talk/new">Create the first post</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/board-talk/${thread.slug}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
                    <div className="flex flex-wrap items-center gap-2 gap-y-2">
                      <h2 className="pr-2 text-lg font-semibold text-foreground sm:text-xl">
                        {capitalizeWords(thread.title)}
                      </h2>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {thread.authorName}
                      </Badge>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/50 pt-6 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {thread.commentCount} {thread.commentCount === 1 ? "comment" : "comments"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />
                        {thread.likeCount} {thread.likeCount === 1 ? "like" : "likes"}
                      </span>
                      <span className="ml-auto sm:ml-0">
                        Active {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
