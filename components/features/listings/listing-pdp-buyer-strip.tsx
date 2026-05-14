import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { reswellProtectionCardClassName } from "@/lib/reswell-protection-surface"

/**
 * Reswell buyer-protection callout — uses `reswellProtectionCardClassName` (Listing PDP / trust UI).
 */
export function ListingPdpBuyerTrustStrip({
  policyHref = "/protection-policy",
  className,
}: {
  policyHref?: string
  className?: string
}) {
  return (
    <div
      className={cn("rounded-lg p-4", reswellProtectionCardClassName, className)}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Buyer Protection</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Every purchase is protected. Get a full refund if the item doesn&apos;t match the listing.{" "}
            <Link
              href={policyHref}
              className="font-medium text-blue-600 underline-offset-[3px] hover:underline dark:text-blue-400"
            >
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
