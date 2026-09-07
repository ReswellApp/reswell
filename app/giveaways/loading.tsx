import { Skeleton } from "@/components/ui/skeleton"

export default function GiveawaysLoading() {
  return (
    <main className="flex-1">
      <section className="relative min-h-[26rem] bg-muted sm:min-h-[30rem] lg:min-h-[32rem]">
        <div className="mx-auto flex min-h-[26rem] max-w-3xl flex-col justify-end px-4 pb-16 sm:min-h-[30rem] sm:px-6 sm:pb-20 lg:min-h-[32rem]">
          <Skeleton className="h-3 w-40 bg-white/30" />
          <Skeleton className="mt-3 h-10 w-full max-w-md bg-white/40 sm:h-12" />
          <Skeleton className="mt-3 h-5 w-full max-w-sm bg-white/25" />
          <Skeleton className="mt-6 h-12 w-44 rounded-full bg-white/40" />
        </div>
      </section>
      <section className="relative z-10 -mt-6 rounded-t-3xl bg-background sm:-mt-8">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="mt-12 h-8 w-64" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </section>
    </main>
  )
}
