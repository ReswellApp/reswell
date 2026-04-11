import Link from "next/link"
import Image from "next/image"
import { Heart, ShieldCheck } from "lucide-react"
import reswellFooterLogo from "@/public/images/reswell-footer-logo.png"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"

const footerLinks = {
  marketplace: [
    { name: "Surfboards", href: "/boards" },
    { name: "Feed", href: "/feed" },
    { name: "Sell your board", href: "/sell" },
    { name: "Sellers", href: "/sellers" },
    { name: "Purchase Protection", href: "/protection-policy" },
  ],
  categories: [
    { name: "All surfboards", href: "/boards" },
    { name: "Shortboards", href: "/boards?type=shortboard" },
    { name: "Longboards", href: "/boards?type=longboard" },
    { name: "Mid-length", href: "/boards?type=funboard" },
  ],
  support: [
    { name: "Help Center", href: "/help" },
    { name: "Safety Tips", href: "/safety" },
    { name: "Shipping Guide", href: "/shipping" },
    { name: "Contact Us", href: "/contact" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Cookie Policy", href: "/cookies" },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50 pb-[env(safe-area-inset-bottom)]">
      <div className="container mx-auto py-10 sm:py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 md:gap-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={reswellFooterLogo}
                alt="Reswell logo"
                className="h-28 w-auto sm:h-32 md:h-40"
                placeholder="blur"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The peer-to-peer marketplace for surfing enthusiasts. Buy, sell, and discover amazing surf gear.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Marketplace</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.marketplace.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className="text-sm text-muted-foreground transition-colors duration-smooth hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Categories</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.categories.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className="text-sm text-muted-foreground transition-colors duration-smooth hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Support</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors duration-smooth hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors duration-smooth hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 space-y-4">
          <div className="flex justify-center">
            <Link
              href="/protection-policy"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Every order protected by Reswell Purchase Protection
            </Link>
          </div>
          <div className="text-center text-sm text-muted-foreground space-y-1.5">
            <p>
              Copyright {new Date().getFullYear()} Reswell. All rights reserved.
            </p>
            <p className="inline-flex w-full flex-wrap items-center justify-center gap-1">
              <span>Made with</span>
              <Heart
                className="h-4 w-4 shrink-0 fill-red-500 text-red-500"
                aria-hidden
              />
              <span>in Santa Barbara.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
