import { Skeleton } from "@/components/ui/skeleton"

const ROWS = Array.from({ length: 7 }, (_, index) => index)
const VIEWS = Array.from({ length: 8 }, (_, index) => index)

export function CaseInboxRowsSkeleton() {
  return (
    <div className="divide-y divide-border/40" role="status" aria-live="polite">
      <span className="sr-only">Loading conversations</span>
      {ROWS.map((row) => (
        <div key={row} className="flex gap-2.5 px-3 py-3">
          <Skeleton className="mt-1 h-2 w-2 rounded-full" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CaseInboxListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="space-y-2 border-b border-border/50 px-3 py-2.5">
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-14" />
        </div>
      </div>
      <CaseInboxRowsSkeleton />
    </div>
  )
}

export function CaseInboxWorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-[49px] shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <div className="ml-3 hidden gap-1.5 lg:flex">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[168px] shrink-0 space-y-2 border-r border-border/60 p-3 xl:block">
          <Skeleton className="mb-4 h-3 w-12" />
          {VIEWS.map((view) => (
            <Skeleton key={view} className="h-7 w-full" />
          ))}
        </aside>

        <section className="flex w-full shrink-0 flex-col border-r border-border/60 md:w-[320px]">
          <CaseInboxListSkeleton />
        </section>

        <section className="hidden min-w-0 flex-1 flex-col md:flex">
          <div className="space-y-2 border-b border-border/60 px-4 py-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex gap-2 border-b border-border/50 px-4 py-2.5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="ml-auto h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="mx-3 mt-3 rounded-lg border border-border/60 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
          </div>
          <div className="flex-1 space-y-5 px-5 py-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-24 w-3/4 rounded-2xl" />
            </div>
            <div className="ml-auto space-y-2">
              <Skeleton className="ml-auto h-3 w-24" />
              <Skeleton className="ml-auto h-20 w-2/3 rounded-2xl" />
            </div>
          </div>
          <div className="border-t border-border/50 p-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </section>

        <aside className="hidden w-[400px] shrink-0 space-y-4 border-l border-border/60 p-4 lg:block">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-36 w-full" />
        </aside>
      </div>
    </div>
  )
}
