export default function FeatureRequestsLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-5 h-8 w-64 animate-pulse rounded-full bg-neutral-100" />
        <div className="mt-6 h-9 w-56 animate-pulse rounded bg-neutral-100" />
        <div className="mt-3 h-12 w-full max-w-xl animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-neutral-100" />
        <div className="mt-8 space-y-6 border-t border-neutral-200 pt-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      </div>
    </main>
  )
}
