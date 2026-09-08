import Link from "next/link"
import { HOW_TO_SELL_HREF, HOW_TO_SHIP_HREF } from "@/lib/seller-resources"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { SellerResourceCard, SellerResourcesShell } from "./seller-resources-shell"

const STEPS = [
  {
    title: "Open Sell and pick a category",
    body: "Go to Sell and choose surfboards, fins, wetsuits, or another gear type. Search the catalog by brand or model to jump-start the form, or list from scratch.",
  },
  {
    title: "Add photos and the facts",
    body: "Upload clear photos (up to 12) and a short title. Add condition, brand, model, size or dimensions, and an honest description so buyers know exactly what they are getting.",
  },
  {
    title: "Choose pickup, shipping, or both",
    body: "Set your location, then offer local pickup, shipping, or both. For shipping you can use Reswell-calculated rates, a flat rate, or free shipping.",
  },
  {
    title: "Set a price and publish",
    body: "Enter your price. Optionally allow offers or drop the price after two weeks. Hit publish — listing is free.",
  },
] as const

export function HowToSellContent() {
  return (
    <SellerResourcesShell
      title="How to Sell"
      description="List surfboards and gear on Reswell in a few minutes. Reach buyers who already shop for used surf equipment — locally or nationwide."
      currentHref={HOW_TO_SELL_HREF}
    >
      <SellerResourceCard title="The listing flow">
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-listingHeart/10 text-sm font-semibold text-listingHeart">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-[#001A4A]">{step.title}</p>
                <p className="mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </SellerResourceCard>

      <SellerResourceCard title="Photos that sell">
        <p>
          Natural light, a clean background, and shots of the nose, tail, rails, and any dings.
          Buyers decide from pictures first — show the board the way you would want to see it.
        </p>
      </SellerResourceCard>

      <SellerResourceCard title="Fees">
        <p>
          Listing is free. When a sale completes, Reswell takes a {MARKETPLACE_FEE_PERCENT}%
          marketplace fee on the item price. You keep {SELLER_SHARE_PERCENT}%. Shipping the buyer
          pays at checkout is not part of your earnings and is not fee&apos;d.
        </p>
      </SellerResourceCard>

      <SellerResourceCard title="After you publish">
        <p>
          Your listing goes live on the marketplace. Buyers can favorite it, message you, make an
          offer if you allow them, or buy at your price. Manage listings from{" "}
          <Link href="/dashboard/listings" className="font-medium text-[#001A4A] underline underline-offset-2">
            My Listings
          </Link>
          . When something sells, ship it or confirm pickup — see{" "}
          <Link href={HOW_TO_SHIP_HREF} className="font-medium text-[#001A4A] underline underline-offset-2">
            How to Ship
          </Link>
          .
        </p>
      </SellerResourceCard>
    </SellerResourcesShell>
  )
}
