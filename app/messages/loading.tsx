export default function MessagesLoading() {
  return (
    <main className="flex-1 bg-gradient-to-b from-muted/40 to-background">
      <div className="container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10">
        <div className="mb-8 space-y-2">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted sm:h-10" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted/70" />
        </div>
        <div className="mb-8 h-12 animate-pulse rounded-2xl bg-muted/80" />
        <div className="divide-y divide-border/60 overflow-hidden rounded-[20px] border border-border/70 bg-card">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3.5 px-4 py-3.5">
                  <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/5 rounded-md bg-muted" />
                <div className="h-3 w-4/5 rounded-md bg-muted/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
