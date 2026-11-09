import { Skeleton } from "@/components/ui/skeleton"

export function SalesMapPageSkeleton() {
  return (
    <main className="flex-1 bg-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_22.5rem] xl:gap-10">
          <div className="space-y-6">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full max-w-lg" />
            <Skeleton className="h-5 w-full max-w-md" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[5.5rem] rounded-[1.25rem]" />
              ))}
            </div>
            <Skeleton className="aspect-[960/600] min-h-[280px] w-full rounded-2xl" />
          </div>
          <Skeleton className="hidden h-[28rem] rounded-2xl lg:block" />
        </div>
      </section>
    </main>
  )
}
