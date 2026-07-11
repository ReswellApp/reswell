import { Skeleton } from "@/components/ui/skeleton"

export default function MapLoading() {
  return (
    <main className="flex-1">
      <section className="container mx-auto px-4 py-4 sm:py-5 md:py-6">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-7 w-full max-w-md sm:h-8" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 lg:grid-cols-4 lg:gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[4.5rem] rounded-xl sm:h-20 sm:rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-3 h-[480px] w-full rounded-xl sm:mt-4 sm:h-[520px] md:h-[560px] lg:h-[600px] sm:rounded-2xl" />
        </div>
      </section>
    </main>
  )
}
