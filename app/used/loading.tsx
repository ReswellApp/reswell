import { Card, CardContent } from "@/components/ui/card"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Skeleton } from "@/components/ui/skeleton"

export default function UsedGearLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-center">Used Surf Gear</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved surf accessories
            </p>
          </div>
        </section>

        {/* Filters Skeleton */}
        <section className="border-b py-4">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Skeleton className="h-10 flex-1 min-w-[200px]" />
              <Skeleton className="h-10 w-[180px]" />
              <Skeleton className="h-10 w-[150px]" />
              <Skeleton className="h-10 w-[170px]" />
              <Skeleton className="h-10 w-[100px]" />
            </div>
          </div>
        </section>

        {/* Listings Skeleton */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
