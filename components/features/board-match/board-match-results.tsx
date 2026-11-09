import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import type { BoardMatchCareerStats, BoardMatchRoundSummary } from "@/lib/types/boardMatch"

export function BoardMatchResults({
  summary,
  career,
  shopHref,
  featuredLabel,
  onPlayAgain,
}: {
  summary: BoardMatchRoundSummary
  career: BoardMatchCareerStats
  shopHref: string
  featuredLabel: string | null
  onPlayAgain: () => void
}) {
  const accuracy =
    summary.questionCount > 0
      ? Math.round((summary.correctCount / summary.questionCount) * 100)
      : 0

  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Round complete
      </p>
      <h2 className="mt-3 font-headline text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
        {summary.totalPoints} points
      </h2>
      <p className="mt-3 text-muted-foreground">
        {summary.correctCount}/{summary.questionCount} correct · {accuracy}% · best streak{" "}
        {summary.bestStreak}
      </p>

      <dl className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-background/80 px-3 py-4 ring-1 ring-border/70">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Career points
          </dt>
          <dd className="mt-1 font-headline text-2xl font-bold tabular-nums tracking-tight">
            {career.totalPoints}
          </dd>
        </div>
        <div className="rounded-xl bg-background/80 px-3 py-4 ring-1 ring-border/70">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Best round
          </dt>
          <dd className="mt-1 font-headline text-2xl font-bold tabular-nums tracking-tight">
            {career.bestRound}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button type="button" size="lg" onClick={onPlayAgain}>
          Play again
        </Button>
        <Button type="button" size="lg" variant="outline" asChild>
          <Link href={shopHref} prefetch={boardsBrowseLinkPrefetch(shopHref)}>
            {featuredLabel ? `Browse ${featuredLabel}` : "Browse boards"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  )
}
