import { Check, X } from "lucide-react"

const ALLOWED = [
  "View your products, prices, photos, and variants",
  "View inventory levels and locations",
  "Keep Reswell listings in sync when products change",
] as const

const DENIED = "Never see your customers, payments, or refunds" as const

export function ShopifyConsentPermissions() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Reswell will be able to
      </p>
      <ul className="space-y-2.5">
        {ALLOWED.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            {item}
          </li>
        ))}
        <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {DENIED}
        </li>
      </ul>
    </div>
  )
}
