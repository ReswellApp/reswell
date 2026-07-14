import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function PayoutRequirementsChecklist({
  items,
  className,
  title = "Stripe still needs",
}: {
  items: string[]
  className?: string
  title?: string
}) {
  if (items.length === 0) return null

  return (
    <div className={cn("rounded-lg border border-border/70 bg-muted/25 px-3.5 py-3", className)}>
      <p className="text-sm font-medium text-foreground mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground leading-snug">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PayoutReadyBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">Ready to cash out</span>
    </div>
  )
}
