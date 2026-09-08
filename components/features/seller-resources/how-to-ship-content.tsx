import Link from "next/link"
import { HOW_TO_SHIP_HREF } from "@/lib/seller-resources"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"
import { SellerResourceCard, SellerResourcesShell } from "./seller-resources-shell"

export function HowToShipContent() {
  return (
    <SellerResourcesShell
      title="How to Ship"
      description="Offer shipping on a listing, pack the board so it arrives in one piece, and get a label after the sale. Pickup-only still works if you prefer to meet locally."
      currentHref={HOW_TO_SHIP_HREF}
    >
      <SellerResourceCard title="Offer shipping when you list">
        <p>
          On each listing you can offer shipping, local pickup, or both. For shipping, pick
          Reswell-calculated rates (from your packed box size and weight), a flat Continental U.S.
          price, or free shipping that you cover.
        </p>
        <p>
          Preview label costs anytime with the{" "}
          <Link
            href="/shipping-estimator"
            className="font-medium text-[#001A4A] underline underline-offset-2"
          >
            shipping estimator
          </Link>
          .
        </p>
      </SellerResourceCard>

      <SellerResourceCard title="After a sale">
        <ol className="space-y-3">
          <li>
            <span className="font-semibold text-[#001A4A]">Pack it well.</span> Pad the nose and
            tail, use a snug board box, and fill gaps so nothing shifts.
          </li>
          <li>
            <span className="font-semibold text-[#001A4A]">Get a label.</span> Open the sale from{" "}
            <Link href="/dashboard/sales" className="font-medium text-[#001A4A] underline underline-offset-2">
              Sales
            </Link>
            . Print the Reswell label when one is ready, or add your own tracking.
          </li>
          <li>
            <span className="font-semibold text-[#001A4A]">Hand it to the carrier.</span> Ship
            within {SHIPPING_DEADLINE_DAYS} days of purchase confirmation when you can, then mark
            the drop-off so the buyer sees progress.
          </li>
        </ol>
      </SellerResourceCard>

      <SellerResourceCard title="How to pack a surfboard">
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          <iframe
            src="https://www.youtube.com/embed/NzDaFE4d9V4?start=14"
            title="How to pack a surfboard for shipping"
            className="aspect-video w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <p>
          Need a box? Order a recyclable surfboard box from{" "}
          <a
            href="https://anewearthproject.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#001A4A] underline underline-offset-2"
          >
            A New Earth Project
          </a>
          , our packing partner.
        </p>
      </SellerResourceCard>

      <SellerResourceCard title="Local pickup">
        <p>
          Meet in public, let the buyer inspect the gear, then enter their pickup code on the sale
          page to release your payout. Read{" "}
          <Link href="/safety" className="font-medium text-[#001A4A] underline underline-offset-2">
            Safety tips
          </Link>{" "}
          before you meet.
        </p>
      </SellerResourceCard>

      <p className="text-sm text-[#5c6b89]">
        Buyer-side details and more label options live in the{" "}
        <Link href="/shipping" className="font-medium text-[#001A4A] underline underline-offset-2">
          full shipping guide
        </Link>
        .
      </p>
    </SellerResourcesShell>
  )
}
