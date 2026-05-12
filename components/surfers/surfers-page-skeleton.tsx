import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_CARD_KEYS = [1, 2, 3, 4, 5, 6] as const

function SurferDirectoryCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-soft sm:p-6"
      aria-hidden
    >
      <div className="flex items-start gap-4">
        <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-5 w-[min(100%,11rem)] max-w-full" />
          <Skeleton className="h-4 w-[min(100%,14rem)] max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-4 h-4 w-[min(100%,85%)] max-w-full flex-1 min-h-[3rem]" />
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-[4.25rem]" />
      </div>
    </div>
  )
}

/**
 * Full-route placeholder while `/surfers` streams — matches hero + directory card grid layout.
 */
export function SurfersPageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-label="Loading surfers directory">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="text-center">
            <Skeleton className="mx-auto h-3 w-24 rounded-full bg-muted/80" />
            <Skeleton className="mx-auto mt-4 h-10 w-[min(100%,12rem)] max-w-full sm:h-11" />
            <div className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-2">
              <Skeleton className="h-4 w-full max-w-lg bg-muted/70" />
              <Skeleton className="h-4 w-full max-w-md bg-muted/70" />
            </div>
            <div className="mx-auto mt-8 max-w-xl">
              <Skeleton className="h-11 w-full rounded-lg bg-muted/80" />
            </div>
          </div>
        </div>
      </section>
      <section className="bg-background" aria-hidden>
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SKELETON_CARD_KEYS.map((key) => (
              <li key={key} className="min-h-0">
                <SurferDirectoryCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
