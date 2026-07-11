import { Skeleton } from "@/components/ui/skeleton"

export default function MapLoading() {
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8 md:py-10">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-10 w-full max-w-xl" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
      <section className="container mx-auto py-6 md:py-8">
        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
      </section>
    </main>
  )
}
