import { Button } from "@/components/ui/button"
import type { BoardMatchCareerStats } from "@/lib/types/boardMatch"

export function BoardMatchIntro({
  career,
  onStart,
  unavailable,
  cardCount,
}: {
  career: BoardMatchCareerStats
  onStart: () => void
  unavailable: boolean
  cardCount: number
}) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Play & earn points
      </p>
      <h1 className="mt-3 font-headline text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
        Board Match
      </h1>
      <p className="mx-auto mt-4 max-w-md text-pretty text-base text-muted-foreground sm:text-lg">
        See a real board from the Reswell catalog. Name the brand for points — nail the model
        name for a bonus.
      </p>

      <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-background/80 px-3 py-4 ring-1 ring-border/70">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Career
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
        <div className="rounded-xl bg-background/80 px-3 py-4 ring-1 ring-border/70">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Games
          </dt>
          <dd className="mt-1 font-headline text-2xl font-bold tabular-nums tracking-tight">
            {career.gamesPlayed}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-col items-center gap-3">
        {unavailable ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            Not enough catalog boards with photos are ready for a round right now. Check back
            soon.
          </p>
        ) : (
          <>
            <Button type="button" size="lg" onClick={onStart} className="min-w-[12rem]">
              Start round
            </Button>
            <p className="text-xs text-muted-foreground">
              {cardCount} boards · brand match + model bonus
            </p>
          </>
        )}
      </div>
    </div>
  )
}
