"use client"

interface FeatureRequestsErrorProps {
  reset: () => void
}

export default function FeatureRequestsError({ reset }: FeatureRequestsErrorProps) {
  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-headline text-2xl font-bold text-neutral-950">Feature requests are unavailable</h1>
        <p className="mt-2 text-sm text-neutral-600">Refresh the page and try again.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-10 rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white hover:bg-[#2F5FE0]"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
