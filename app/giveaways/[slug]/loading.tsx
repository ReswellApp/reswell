import { Skeleton } from "@/components/ui/skeleton"

export default function GiveawayDetailLoading() {
  return (
    <main className="flex-1">
      <section className="relative min-h-[20rem] bg-muted sm:min-h-[24rem] lg:min-h-[26rem]">
        <div className="mx-auto flex min-h-[20rem] max-w-3xl flex-col justify-end px-4 pb-14 sm:min-h-[24rem] sm:px-6 sm:pb-16 lg:min-h-[26rem]">
          <Skeleton className="h-3 w-40 bg-white/30" />
          <Skeleton className="mt-3 h-10 w-full max-w-md bg-white/40 sm:h-12" />
          <Skeleton className="mt-3 h-5 w-full max-w-sm bg-white/25" />
        </div>
      </section>
      <section className="relative z-10 -mt-6 rounded-t-3xl bg-background px-4 py-10 sm:-mt-8 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-7 w-36" />
          <div className="mt-5 space-y-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="mt-12 h-7 w-40" />
          <Skeleton className="mt-5 h-40 rounded-2xl" />
        </div>
      </section>
    </main>
  )
}
