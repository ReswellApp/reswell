import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { sellerResourcesNavLinks } from "@/lib/seller-resources"
import { cn } from "@/lib/utils"

export function SellerResourcesShell({
  title,
  description,
  currentHref,
  children,
  showSellCta = true,
}: {
  title: string
  description: string
  currentHref: string
  children: ReactNode
  showSellCta?: boolean
}) {
  return (
    <main className="flex-1 bg-[#F4F7FB]">
      <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
          Seller Resources
        </p>
        <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5c6b89]">{description}</p>

        <nav
          aria-label="Seller resource pages"
          className="mt-6 flex flex-wrap gap-2"
        >
          {sellerResourcesNavLinks.map((item) => {
            const active = item.href === currentHref
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-listingHeart/20 bg-listingHeart/10 text-listingHeart"
                    : "border-border bg-background text-foreground/80 hover:border-listingHeart/25 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-8 space-y-6">{children}</div>

        {showSellCta ? (
          <div className="mt-10 rounded-2xl border border-listingHeart/15 bg-white px-6 py-7 text-center">
            <p className="font-headline text-xl font-bold text-[#001A4A]">Ready to list?</p>
            <p className="mt-1 text-sm text-[#5c6b89]">
              It is free to post. Fees apply only when you make a sale.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-5 rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
            >
              <Link href="/sell">Start a listing</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  )
}

export function SellerResourceCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-[#001A4A]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#5c6b89]">{children}</div>
    </section>
  )
}
