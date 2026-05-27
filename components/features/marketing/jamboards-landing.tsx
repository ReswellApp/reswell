import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BoardTalkPreview } from "@/components/features/forum/board-talk-preview"
import type { BoardTalkThreadPreview } from "@/lib/services/forumThreads"

export type JamboardsLandingProps = {
  threads: BoardTalkThreadPreview[]
  userId: string | null
}

export function JamboardsLanding({ threads, userId }: JamboardsLandingProps) {
  const newPostHref = userId
    ? "/board-talk/new"
    : `/auth/login?redirect=${encodeURIComponent("/board-talk/new")}`

  return (
    <main className="flex-1">
      <section className="border-b border-border/60 bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Jamboards Alternative
            </h1>
            <p className="mt-4 text-pretty text-lg text-muted-foreground sm:text-xl">
              The community corner for surfers — swap stories, ask questions, and talk boards with people who get it.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/board-talk">
                  Join Reswell Board Talk
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={newPostHref}>Start a post</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6">
          <BoardTalkPreview threads={threads} />
        </div>
      </section>
    </main>
  )
}
