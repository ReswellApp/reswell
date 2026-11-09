import Link from "next/link"
import { BadgePercent, Store, Truck } from "lucide-react"
import { ForSurfShopsFaq } from "@/components/features/marketing/for-surf-shops-faq"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"
import {
  FOR_SURF_SHOPS_HERO_DESCRIPTION,
  FOR_SURF_SHOPS_STEPS,
  FOR_SURF_SHOPS_USES,
  FOR_SURF_SHOPS_VALUES,
  forSurfShopsAccountHref,
  forSurfShopsAccountLabel,
  forSurfShopsSignInHref,
} from "@/lib/for-surf-shops"
import { HOW_TO_SELL_HREF } from "@/lib/seller-resources"

const VALUE_ICONS = {
  fee: BadgePercent,
  shipping: Truck,
  shop: Store,
} as const

export function ForSurfShopsLanding({ signedIn }: { signedIn: boolean }) {
  const accountHref = forSurfShopsAccountHref(signedIn)
  const accountLabel = forSurfShopsAccountLabel(signedIn)

  return (
    <main className="flex-1 bg-white">
      <SellerResourcesHero
        eyebrow="For surf shops"
        title="Sell the used boards in your shop"
        description={FOR_SURF_SHOPS_HERO_DESCRIPTION}
        primaryCta={{ href: accountHref, label: accountLabel }}
        secondaryCta={{ href: HOW_TO_SELL_HREF, label: "See how selling works" }}
        note={
          signedIn ? null : (
            <>
              Already have an account?{" "}
              <Link
                href={forSurfShopsSignInHref()}
                className="font-medium text-[#001A4A] underline underline-offset-4"
              >
                Sign in
              </Link>
            </>
          )
        }
      />

      <SellerResourcesValueStrip
        items={FOR_SURF_SHOPS_VALUES.map((item) => ({
          icon: VALUE_ICONS[item.key],
          title: item.title,
          body: item.body,
        }))}
      />

      <HowToSellSection
        eyebrow="How it works"
        title="From the used rack to a live listing"
        lead="Same Sell flow every Reswell seller uses. Built for shops moving more than one board."
      >
        <ol className="space-y-5">
          {FOR_SURF_SHOPS_STEPS.map((step, index) => (
            <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
              {step.body}
            </SellerResourcesHowCard>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#5c6b89]">
          Shops in Santa Barbara can drop a sold board off and Reswell packs and ships it.{" "}
          <Link
            href={SANTA_BARBARA_DROPOFF_HREF}
            className="font-medium text-[#001A4A] underline underline-offset-4"
          >
            How drop-off works
          </Link>
        </p>
      </HowToSellSection>

      <HowToSellSection
        wash
        eyebrow="What to list"
        title="Boards that belong on Reswell"
      >
        <ul className="grid gap-5 md:grid-cols-3">
          {FOR_SURF_SHOPS_USES.map((item) => (
            <li
              key={item.title}
              className="rounded-[1.75rem] bg-white px-6 py-8 ring-1 ring-border"
            >
              <p className="text-xl font-bold tracking-tight text-[#001A4A]">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{item.body}</p>
            </li>
          ))}
        </ul>
      </HowToSellSection>

      <HowToSellSection
        eyebrow="Questions"
        title={signedIn ? "Selling from the shop" : "Before you open an account"}
        className="bg-[#E8EEF8]"
      >
        <ForSurfShopsFaq />
      </HowToSellSection>

      <SellerResourcesCta
        title={signedIn ? "List the next board" : "Open your shop account"}
        description="Free to post. The marketplace fee applies only when a board sells."
        href={accountHref}
        label={accountLabel}
      />
    </main>
  )
}
