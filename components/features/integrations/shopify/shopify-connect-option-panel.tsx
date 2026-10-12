import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ShopifyConnectOptionPanelProps {
  icon: LucideIcon
  title: string
  badge: string
  recommended?: boolean
  description: string
  children: ReactNode
}

export function ShopifyConnectOptionPanel({
  icon: Icon,
  title,
  badge,
  recommended = false,
  description,
  children,
}: ShopifyConnectOptionPanelProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        recommended && "border-primary/30 bg-primary/[0.03] shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background",
              recommended && "border-primary/30 text-primary",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <Badge variant={recommended ? "default" : "outline"}>{badge}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-auto">{children}</div>
    </section>
  )
}
