export default function SupportHubLoading() {
  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 xl:max-w-4xl">
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
          <div className="h-12 animate-pulse rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
