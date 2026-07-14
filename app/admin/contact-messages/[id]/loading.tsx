import { Loader2 } from "lucide-react"

export default function AdminContactMessageTicketLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      <p className="text-sm">Loading support thread…</p>
    </div>
  )
}
