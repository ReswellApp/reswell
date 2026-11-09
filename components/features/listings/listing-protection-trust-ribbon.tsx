import Link from "next/link"
import { Lock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  reswellProtectionCardClassName,
  reswellProtectionTrustRibbonColumnDividerClassName,
} from "@/lib/reswell-protection-surface"

export type ListingProtectionTrustRibbonViewer = "buyer" | "seller"

/** Reswell protection + secure checkout callout (shared PDP placement). */
export function ListingProtectionTrustRibbon({
  className,
  viewerRole = "buyer",
}: {
  className?: string
  /** When `seller`, copy speaks to the listing owner viewing their own listing. */
  viewerRole?: ListingProtectionTrustRibbonViewer
}) {
  const isSellerView = viewerRole === "seller"

  const protectionTitle = isSellerView ? "Reswell sellers protection" : "Reswell protection"
  const protectionBody = isSellerView
    ? "Eligible sales through checkout follow clear Purchase Protection rules—you're not charged an extra fee for it. Approved buyer refunds are funded from our marketplace fee; your agreed seller share stays as promised."
    : "Guided returns on eligible purchases, secure transactions through checkout, real support when you need it."
  const protectionPolicyHref = isSellerView ? "/protection-policy#seller-protections" : "/protection-policy"

  return (
    <div
      className={cn(
        "rounded-xl px-5 py-5",
        reswellProtectionCardClassName,
        !isSellerView && "grid gap-4 sm:grid-cols-2",
        className,
      )}
    >
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-foreground">{protectionTitle}</p>
          <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
            {protectionBody}
          </p>
          <Link
            href={protectionPolicyHref}
            className="mt-2 inline-block text-[14px] font-semibold underline underline-offset-4"
          >
            Learn more
          </Link>
        </div>
      </div>
      {!isSellerView ? (
        <div className={cn("flex gap-3", reswellProtectionTrustRibbonColumnDividerClassName)}>
          <Lock className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground">Secure checkout</p>
            <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
              At Reswell, your safety comes first—we use industry-standard encryption every time you pay.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Buyer-oriented Reswell protection callout for the left column PDP. */
export function ListingBuyerProtectionTrustRibbon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 rounded-xl px-5 py-5",
        reswellProtectionCardClassName,
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#4263eb]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-foreground">Reswell protection</p>
        <p className="mt-1 text-[14px] leading-snug text-neutral-700 dark:text-neutral-300">
          Shop knowing eligible purchases include Purchase Protection—clear coverage rules, a dispute path if the
          item isn&apos;t as described, and our team when you need a hand.
        </p>
        <Link
          href="/protection-policy"
          className="mt-2 inline-block text-[14px] font-semibold underline underline-offset-4"
        >
          Learn more
        </Link>
      </div>
    </div>
  )
}
