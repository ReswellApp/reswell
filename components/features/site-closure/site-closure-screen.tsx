import Image from "next/image"
import Link from "next/link"
import { SiteClosureAccountLink } from "@/components/features/site-closure/site-closure-account-link"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { SITE_CLOSURE_ACCOUNT_HOME } from "@/lib/site-closure"

export type SiteClosureAccount = {
  name: string
  avatarUrl: string | null
}

const HERO = {
  src: "/images/home/hero-backdrop-tahiti.jpg",
  alt: "A surfer crouched inside a glassy barrel, photographed from underwater",
} as const

const loginHref = `/auth/login?redirect=${encodeURIComponent(SITE_CLOSURE_ACCOUNT_HOME)}`

export function SiteClosureScreen({ account }: { account: SiteClosureAccount | null }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="border-b border-border bg-background text-foreground">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
          <SiteWordmarkLink
            href="/"
            className="px-0 py-0 sm:px-0 sm:py-0"
            imgClassName="max-h-6 sm:max-h-7"
          />
          {account ? (
            <SiteClosureAccountLink name={account.name} avatarUrl={account.avatarUrl} />
          ) : (
            <Link
              href={loginHref}
              className="text-sm text-foreground transition-colors hover:text-foreground/70"
            >
              Login
            </Link>
          )}
        </div>
      </header>

      <div className="relative h-[46vh] min-h-72 w-full bg-black">
        <Image
          src={HERO.src}
          alt={HERO.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
      </div>

      <main className="bg-background text-foreground">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
          <h1 className="text-center font-headline text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Thank you from the Reswell team
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-center text-base font-medium leading-relaxed text-foreground sm:mt-10 sm:text-lg">
            We have closed down the site and platform on 11/15/26.
          </p>
          <div className="mx-auto mt-10 max-w-xl space-y-6 text-[15px] font-light leading-relaxed text-foreground sm:text-base">
            <p>
              We started Reswell to make buying and selling surf gear easier and more
              enjoyable for all of us surfers. You showed up for that, and we want to thank
              you.
            </p>
            <p>
              You trusted us to connect surfers beyond your local region to buy and sell
              their gear, and you were a part of our short-lived journey, one we put a lot
              of heart and soul into. If you bought or sold anything here, we hope
              you&apos;re enjoying that board or those fins and that they keep getting you
              out in the water for some fun surf.
            </p>
            <p>
              Our goal was to build the place for surfers to connect and buy and sell
              surfboards, fins, and more. Unfortunately, Reswell didn&apos;t gain the
              traction we needed to continue, and we had to make the very hard decision to
              shut it down for good. We were looking forward to continuing to build and
              grow Reswell, so this wasn&apos;t easy.
            </p>
            <p>
              Thank you all for being here, for being a part of our journey, and for
              believing in us.
            </p>
            <p>
              With love and gratitude,
              <br />
              The Reswell team
            </p>
            <div className="border-t border-border pt-6">
              <p>
                I am grateful for all of you who came to be a part of our short-lived journey
                here at Reswell. I am saddened to close this down, but it is the best and
                hardest decision I have had to make in a long time. It was fun while it
                lasted. We hope we brought you joy. I wish you all the best.
              </p>
              <p>— Hayden Garfield</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-background text-foreground">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm sm:px-8">© 2026</div>
      </footer>
    </div>
  )
}
