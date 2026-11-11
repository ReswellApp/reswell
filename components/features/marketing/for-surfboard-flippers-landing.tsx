import Image from "next/image"
import Link from "next/link"
import { FadeInSection } from "@/components/fade-in-section"
import { ForSurfboardFlippersFaq } from "@/components/features/marketing/for-surfboard-flippers-faq"
import { ForSurfboardFlippersPartnerForm } from "@/components/features/marketing/for-surfboard-flippers-partner-form"
import { Button } from "@/components/ui/button"
import {
  FOR_SURFBOARD_FLIPPERS_HERO_DESCRIPTION,
  FOR_SURFBOARD_FLIPPERS_OFFER,
  FOR_SURFBOARD_FLIPPERS_OFFER_ANCHOR,
  FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS,
  FOR_SURFBOARD_FLIPPERS_STEPS,
  FOR_SURFBOARD_FLIPPERS_WHY,
  forSurfboardFlippersOfferHref,
  forSurfboardFlippersOfferLabel,
  forSurfboardFlippersSignInHref,
} from "@/lib/for-surfboard-flippers"
import { MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import { wideShimmer } from "@/lib/image-shimmer"
import heroAtmosphere from "@/public/images/brand/boards-browse-barrel.jpg"

export function ForSurfboardFlippersLanding({ signedIn }: { signedIn: boolean }) {
  const offerHref = forSurfboardFlippersOfferHref()
  const offerLabel = forSurfboardFlippersOfferLabel()

  return (
    <main className="flex-1 bg-white">
      <section className="relative isolate min-h-[100svh] w-full overflow-hidden">
        <Image
          src={heroAtmosphere}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-[center_40%] for-surfboard-flippers-hero-media"
          placeholder="blur"
          blurDataURL={wideShimmer}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#04070E]/50 via-[#001A4A]/70 to-[#04070E]/88"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
          <div className="for-surfboard-flippers-hero-copy max-w-xl">
            <p className="font-headline text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Reswell
            </p>
            <h1 className="mt-4 font-headline text-[clamp(2.15rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-white">
              Six months.
              <br />
              No selling fees.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/85 sm:text-lg">
              {FOR_SURFBOARD_FLIPPERS_HERO_DESCRIPTION}
            </p>
            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-8 font-semibold text-[#001A4A] hover:bg-white/90"
              >
                <Link href={offerHref}>{offerLabel}</Link>
              </Button>
            </div>
            {!signedIn ? (
              <p className="mt-5 text-sm text-white/65">
                Already on Reswell?{" "}
                <Link
                  href={forSurfboardFlippersSignInHref()}
                  className="font-medium text-white underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                then apply.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <FadeInSection>
        <section
          id={FOR_SURFBOARD_FLIPPERS_OFFER_ANCHOR}
          className="scroll-mt-24 bg-[#001A4A] px-4 py-14 sm:px-6 sm:py-16"
        >
          <div className="mx-auto max-w-lg text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {FOR_SURFBOARD_FLIPPERS_OFFER.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              {FOR_SURFBOARD_FLIPPERS_OFFER.lead}
            </p>
            <div className="mt-8 flex items-end justify-center gap-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Standard
                </p>
                <p className="mt-1 font-headline text-4xl font-bold text-white/40 line-through decoration-white/30">
                  {MARKETPLACE_FEE_PERCENT}%
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7F9DD5]">
                  {FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months
                </p>
                <p className="mt-1 font-headline text-5xl font-bold text-white">0%</p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-white/55">
              {FOR_SURFBOARD_FLIPPERS_OFFER.after}
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-sm">
            <ForSurfboardFlippersPartnerForm />
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="border-b border-border/70 bg-white px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
              {FOR_SURFBOARD_FLIPPERS_WHY.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#5c6b89] sm:text-lg">
              {FOR_SURFBOARD_FLIPPERS_WHY.body}
            </p>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="bg-[#F4F7FB] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-headline text-3xl font-bold tracking-tight text-[#001A4A]">
              How it works
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {FOR_SURFBOARD_FLIPPERS_STEPS.map((step, index) => (
                <li key={step.title} className="text-center sm:text-left">
                  <p className="font-headline text-3xl font-bold text-[#5574AD]">{index + 1}</p>
                  <p className="mt-2 text-lg font-bold tracking-tight text-[#001A4A]">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5c6b89]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="bg-[#E8EEF8] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-headline text-3xl font-bold tracking-tight text-[#001A4A]">
              Questions
            </h2>
            <div className="mt-8">
              <ForSurfboardFlippersFaq />
            </div>
          </div>
        </section>
      </FadeInSection>
    </main>
  )
}
