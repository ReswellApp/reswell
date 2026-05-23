import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const inboxContainerClass =
  "container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10 md:max-w-4xl lg:max-w-5xl"

const threadContainerClass =
  "container mx-auto flex min-h-0 max-w-2xl flex-1 flex-col px-4 pb-4 pt-2 sm:px-5 sm:pb-6 sm:pt-3 md:max-w-4xl lg:max-w-5xl"

const groupedShellClass =
  "overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border"

function MessagesTabBarSkeleton() {
  return (
    <div
      className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
      aria-hidden
    >
      <Skeleton className="h-[46px] flex-1 rounded-[11px] sm:h-[48px]" />
      <Skeleton className="h-[46px] flex-1 rounded-[11px] bg-muted/60 sm:h-[48px]" />
      <Skeleton className="h-[46px] flex-1 rounded-[11px] bg-muted/50 sm:h-[48px]" />
    </div>
  )
}

function ChatListRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

export function MessagesInboxSkeleton({ className }: { className?: string }) {
  return (
    <main className={cn("flex-1 bg-background", className)} aria-busy="true" aria-label="Loading messages">
      <div className={inboxContainerClass}>
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48 sm:h-10" />
            <Skeleton className="h-4 w-full max-w-xl bg-muted/70" />
          </div>
          <Skeleton className="h-11 w-full shrink-0 rounded-full sm:mt-1 sm:w-36" />
        </header>

        <Skeleton className="mb-5 h-12 w-full rounded-2xl" />

        <MessagesTabBarSkeleton />

        <div className={cn("divide-y divide-border/60", groupedShellClass)}>
          {[1, 2, 3, 4].map((i) => (
            <ChatListRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}

function ActivityCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/90 p-3">
      <div className="flex gap-3">
        <Skeleton className="h-[60px] w-[60px] shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2 py-0.5">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  )
}

export function MessagesActivityTabSkeleton({
  shellClassName,
}: {
  shellClassName?: string
}) {
  return (
    <div
      className={cn(
        "space-y-2.5 rounded-[22px] border border-dashed border-border/60 bg-muted/20 p-3 sm:space-y-3 sm:p-4",
        shellClassName,
      )}
      aria-busy="true"
      aria-label="Loading activity"
    >
      {[1, 2, 3].map((i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function MessagesOffersTabSkeleton({
  shellClassName,
}: {
  shellClassName?: string
}) {
  return (
    <div className={cn("space-y-3", shellClassName)} aria-busy="true" aria-label="Loading offers">
      <div className="mb-4 flex w-full gap-1 rounded-xl border border-border/70 bg-muted/50 p-1">
        <Skeleton className="h-[42px] flex-1 rounded-lg" />
        <Skeleton className="h-[42px] flex-1 rounded-lg bg-muted/60" />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
        >
          <div className="flex flex-col sm:flex-row">
            <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[13rem] shrink-0 rounded-none sm:mx-0 sm:w-36" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
              <div className="mt-auto flex gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConversationThreadSkeleton({ className }: { className?: string }) {
  return (
    <main
      className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}
      aria-busy="true"
      aria-label="Loading conversation"
    >
      <div className={threadContainerClass}>
        <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-background/85 px-2 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-5 sm:px-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 py-0.5">
              <Skeleton className="h-5 w-[min(100%,11rem)] max-w-full" />
              <Skeleton className="h-4 w-[min(100%,14rem)] max-w-full" />
            </div>
          </div>
        </header>

        <Skeleton className="mb-4 h-[96px] w-full rounded-[18px]" />

        <div
          className={cn(
            "flex shrink-0 flex-col overflow-hidden rounded-[22px] border border-border/50 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-muted/25",
            "h-[min(22rem,42svh)] max-h-[min(26rem,52svh)] sm:h-[min(24rem,45svh)] md:h-[min(34rem,52svh)] md:max-h-[min(42rem,68svh)] lg:h-[min(38rem,56svh)] lg:max-h-[min(48rem,72svh)]",
          )}
        >
          <div className="flex flex-1 flex-col justify-end gap-3 p-4 pb-8">
            <div className="flex justify-start">
              <Skeleton className="h-12 w-[min(72%,18rem)] rounded-[20px] rounded-bl-[6px]" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-11 w-[min(55%,14rem)] rounded-[20px] rounded-br-[6px]" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-24 w-[min(85%,20rem)] max-w-[min(100%,28rem)] rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="mt-3 shrink-0">
          <Skeleton className="h-[52px] w-full rounded-[24px]" />
        </div>
      </div>
    </main>
  )
}

function CounterpartyThreadRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

export function CounterpartyThreadsSkeleton({ className }: { className?: string }) {
  return (
    <main className={cn("flex-1 bg-background", className)} aria-busy="true" aria-label="Loading conversations">
      <div className={inboxContainerClass}>
        <header className="mb-6 flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </header>

        <div className={cn("divide-y divide-border/40", groupedShellClass)}>
          {[1, 2, 3].map((i) => (
            <CounterpartyThreadRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  )
}
