import { Skeleton } from "@/components/ui/skeleton"

export default function TopCitiesLoading() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-3xl text-center">
            <Skeleton className="mx-auto h-3 w-24" />
            <Skeleton className="mx-auto mt-3 h-9 w-full max-w-md sm:h-10" />
            <Skeleton className="mx-auto mt-3 h-5 w-full max-w-xl" />
          </div>
          <Skeleton className="mx-auto mt-8 h-[220px] w-full max-w-5xl rounded-xl sm:h-[260px] md:h-[280px] sm:rounded-2xl" />
        </div>
      </section>
      <section className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl sm:h-28 sm:rounded-2xl" />
          ))}
        </div>
      </section>
    </main>
  )
}
