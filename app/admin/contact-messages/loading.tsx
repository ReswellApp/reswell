import { Loader2 } from "lucide-react"

export default function AdminContactMessagesLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Loading contact messages…</p>
    </div>
  )
}
