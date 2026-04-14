export default function DashboardOffersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-lg rounded-md bg-muted/70" />
      </div>
      <div className="flex h-12 max-w-lg gap-1 rounded-xl bg-muted/80 p-1">
        <div className="h-full flex-1 rounded-lg bg-muted" />
        <div className="h-full flex-1 rounded-lg bg-muted/60" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-border/50 bg-muted/30" />
        ))}
      </div>
    </div>
  )
}
