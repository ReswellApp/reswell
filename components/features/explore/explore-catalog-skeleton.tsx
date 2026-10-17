export function ExploreCatalogSkeleton() {
  return (
    <section className="py-10 sm:py-14" aria-hidden>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="skeleton mb-8 h-8 w-48 max-w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="skeleton aspect-[3/4] w-full rounded-xl" />
          ))}
        </div>
        <span className="sr-only">Loading explore listings</span>
      </div>
    </section>
  )
}
