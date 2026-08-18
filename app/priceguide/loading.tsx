import { Skeleton } from "@/components/ui/skeleton"

export default function PriceGuideLoading() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Skeleton className="mx-auto h-3 w-28" />
          <Skeleton className="mx-auto mt-3 h-10 w-full max-w-lg" />
          <Skeleton className="mx-auto mt-4 h-5 w-full max-w-xl" />
          <Skeleton className="mx-auto mt-8 h-14 w-full max-w-xl rounded-2xl" />
        </div>
      </section>
      <section className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      </section>
    </main>
  )
}
