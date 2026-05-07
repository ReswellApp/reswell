"use client"

import Image from "next/image"
import { HomeHowItWorksBuyerCurator } from "@/components/home-how-it-works-buyer-curator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { portraitShimmer } from "@/lib/image-shimmer"

const SELLER_STEPS = [
  {
    imageSrc: "/images/home/how-it-works-sell-list.png",
    imageAlt: "Surfer in a wetsuit riding a wave, black and white",
    title: "List your board",
    body:
      "Add photos, dimensions, condition, and price. Offer local pickup, shipping, or both so buyers know how the handoff works.",
  },
  {
    imageSrc: "/images/home/how-it-works-sell-connect.png",
    imageAlt: "Aerial view of a coastline at sunset with surfers in the lineup",
    title: "Connect with buyers",
    body:
      "Get messages, offers, and questions in one place. When it’s a match, agree on pickup or ship it out. Your call.",
  },
  {
    imageSrc: "/images/home/how-it-works-sell-paid.png",
    imageAlt: "Surfer turning on a large green wave with spray",
    title: "Get paid directly",
    body:
      "When the sale is done, your earnings are yours. Cash out straight to your bank when you’re ready. Simple and community-first.",
  },
] as const

export type HomeHowItWorksBuyerHighlightImages = {
  shortboard: string
  hybrid: string
  longboard: string
}

type Step = (typeof SELLER_STEPS)[number]

/** Copy under live listing photos (left: shortboard, middle: hybrid, right: longboard). */
const BUYER_STEPS_COPY = [
  {
    title: "Find your next board",
    body:
      "Browse shortboards, longboards, grovelers, and more from locals and shops. Prices you won’t see off the rack.",
    imageAlt: "Latest shortboard listing photo from the Reswell marketplace",
  },
  {
    title: "Save & follow",
    body:
      "Save listings for later and follow sellers or shops. When they post new boards, you’ve got a quick way back.",
    imageAlt: "Latest hybrid surfboard listing photo from the Reswell marketplace",
  },
  {
    title: "Buy the way you want",
    body:
      "Message sellers, check out securely in the app, and meet in person or get it shipped. Whatever works for the session ahead.",
    imageAlt: "Latest longboard listing photo from the Reswell marketplace",
  },
] as const

function BuyerHowItWorksGrid({ images }: { images: HomeHowItWorksBuyerHighlightImages }) {
  const srcs = [images.shortboard, images.hybrid, images.longboard] as const

  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {BUYER_STEPS_COPY.map((copy, i) => (
        <div key={copy.title} className="flex flex-col items-center text-center">
          <div className="relative mb-5 w-full max-w-xs overflow-hidden rounded-2xl border border-border/60 bg-muted/30 aspect-[3/4] sm:max-w-none">
            <Image
              src={srcs[i]}
              alt={copy.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={portraitShimmer}
            />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{copy.title}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty max-w-sm mx-auto">
            {copy.body}
          </p>
        </div>
      ))}
    </div>
  )
}

function HowItWorksGrid({ steps }: { steps: readonly Step[] }) {
  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {steps.map((step) => (
        <div key={step.title} className="flex flex-col items-center text-center">
          <div className="relative mb-5 w-full max-w-xs overflow-hidden rounded-2xl border border-border/60 bg-muted/30 aspect-[3/4] sm:max-w-none">
            <Image
              src={step.imageSrc}
              alt={step.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={portraitShimmer}
            />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{step.title}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty max-w-sm mx-auto">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  )
}

type HomeHowItWorksSectionProps = {
  buyerHighlightImages: HomeHowItWorksBuyerHighlightImages
  /** When true, shows admin-only controls on the homepage “How it works” buyer images */
  isAdmin?: boolean
}

export function HomeHowItWorksSection({ buyerHighlightImages, isAdmin }: HomeHowItWorksSectionProps) {
  return (
    <section className="py-16" aria-labelledby="how-it-works-heading">
      <div className="container mx-auto">
        <div className="relative flex justify-center px-12 sm:px-14 lg:px-16">
          <h2
            id="how-it-works-heading"
            className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            How it works
          </h2>
          {isAdmin ? (
            <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 sm:block">
              <HomeHowItWorksBuyerCurator isAdmin={Boolean(isAdmin)} />
            </div>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="mt-6 flex justify-center sm:hidden">
            <HomeHowItWorksBuyerCurator isAdmin={Boolean(isAdmin)} />
          </div>
        ) : null}
        <Tabs defaultValue="seller" className="mt-8 w-full sm:mt-10">
          <div className="mx-auto max-w-2xl">
            <TabsList
              className="flex h-auto w-full justify-center gap-0 overflow-visible rounded-none border-0 bg-transparent p-0"
            >
              <TabsTrigger
                value="seller"
                className={cn(
                  "flex-1 rounded-none border-0 border-b-2 border-border bg-transparent py-3 text-sm font-medium uppercase tracking-wide",
                  "text-muted-foreground shadow-none ring-0 ring-offset-0",
                  "data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:font-semibold data-[state=inactive]:font-normal",
                  "hover:text-foreground/80",
                )}
              >
                I&rsquo;m selling
              </TabsTrigger>
              <TabsTrigger
                value="buyer"
                className={cn(
                  "flex-1 rounded-none border-0 border-b-2 border-border bg-transparent py-3 text-sm font-medium uppercase tracking-wide",
                  "text-muted-foreground shadow-none ring-0 ring-offset-0",
                  "data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:font-semibold data-[state=inactive]:font-normal",
                  "hover:text-foreground/80",
                )}
              >
                I&rsquo;m buying
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="mt-10 sm:mt-12">
            <TabsContent value="seller" className="mt-0 focus-visible:outline-none">
              <HowItWorksGrid steps={SELLER_STEPS} />
            </TabsContent>
            <TabsContent value="buyer" className="mt-0 focus-visible:outline-none">
              <BuyerHowItWorksGrid images={buyerHighlightImages} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  )
}
