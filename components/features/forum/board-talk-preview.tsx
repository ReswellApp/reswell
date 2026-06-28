import Link from "next/link"
import { ArrowRight, Heart, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { capitalizeWords } from "@/lib/listing-labels"
import type { BoardTalkThreadPreview } from "@/lib/services/forumThreads"
import { cn } from "@/lib/utils"

type BoardTalkPreviewProps = {
  threads: BoardTalkThreadPreview[]
  className?: string
  /** When true, renders a compact section header suited for landing pages. */
  showSectionHeader?: boolean
}

export function BoardTalkPreview({
  threads,
  className,
  showSectionHeader = true,
}: BoardTalkPreviewProps) {
  return (
    <section className={cn("scroll-mt-24", className)} aria-labelledby="board-talk-preview-heading">
      {showSectionHeader ? (
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 id="board-talk-preview-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
              Threads
            </h2>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              See what surfers are discussing — board picks, local breaks, and gear talk from the community.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" asChild>
            <Link href="/threads">
              See all posts
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-muted-foreground sm:px-8">
            <p>No posts yet — be the first to start a conversation.</p>
            <Button variant="outline" asChild className="mt-6">
              <Link href="/threads">Go to Threads</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-5 sm:space-y-6">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/threads/${thread.slug}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="px-6 py-5 sm:px-8 sm:py-6">
                    <div className="flex flex-wrap items-center gap-2 gap-y-2">
                      <h3 className="pr-2 text-lg font-semibold text-foreground sm:text-xl">
                        {capitalizeWords(thread.title)}
                      </h3>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {thread.authorName}
                      </Badge>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/50 pt-5 text-xs text-muted-foreground">
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
    </section>
  )
}
