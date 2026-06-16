import { Skeleton } from "@/components/ui/skeleton"

export default function CheckoutLoading() {
  return (
    <main className="flex-1 w-full bg-background pt-8 pb-16 md:pb-20 lg:pb-24">
      <div className="container mx-auto max-w-2xl lg:max-w-6xl">
        <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>

        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
          <div className="flex w-full flex-1 flex-col lg:flex-row">
            <div className="order-1 flex-1 bg-white px-4 py-8 sm:px-8 lg:max-w-[640px] lg:shrink-0 lg:px-10 lg:py-10 xl:px-14">
              <div className="mx-auto max-w-[520px] space-y-10 lg:mx-0">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-11 w-full rounded-[6px]" />
                  <Skeleton className="h-11 w-full rounded-[6px]" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-[280px] w-full rounded-[8px]" />
                </div>
              </div>
            </div>

            <aside className="order-2 border-b border-neutral-200 bg-[#F5F5F5] px-4 py-8 sm:px-8 lg:order-2 lg:w-[min(420px,42%)] lg:shrink-0 lg:border-b-0 lg:border-l lg:border-neutral-200 lg:px-8 lg:py-10">
              <div className="mx-auto max-w-[400px] space-y-6 lg:mx-0">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-[8px]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="space-y-2 border-t border-neutral-200/90 pt-6">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}
