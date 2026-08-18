import Link from "next/link"
import { Instagram, ShieldCheck } from "lucide-react"
import { FooterNewsletterSignup } from "@/components/features/marketing/footer-newsletter-signup"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { siteFooterNavLinks } from "@/lib/site-footer-nav"
import { footerCategoryLinks } from "@/lib/site-category-directory"
import { cn } from "@/lib/utils"

const footerLinkClassName =
  "text-sm text-white/75 transition-colors duration-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart rounded-sm"

export function Footer() {
  return (
    <footer className="border-t border-white/15 bg-listingHeart pb-[env(safe-area-inset-bottom)] text-white">
      <div className="container mx-auto py-10 sm:py-14">
        <FooterNewsletterSignup />

        <div className="mt-10 grid grid-cols-2 gap-8 md:mt-12 md:grid-cols-4 lg:grid-cols-5 md:gap-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <SiteWordmarkLink
              variant="footer"
              className="-ml-1 px-0 sm:ml-0"
              imgClassName="brightness-0 invert"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              The peer-to-peer marketplace for surfing enthusiasts. Buy, sell, and discover amazing surf gear.
            </p>
            <a
              href="https://www.instagram.com/reswellll/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Reswell on Instagram"
              className="mt-4 inline-flex text-white/75 transition-colors duration-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart rounded-sm"
            >
              <Instagram className="h-5 w-5" aria-hidden />
            </a>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="text-sm font-semibold text-white">Marketplace</h3>
            <ul className="mt-4 space-y-3">
              {siteFooterNavLinks.marketplace.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className={footerLinkClassName}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-white">Categories</h3>
            <ul className="mt-4 space-y-3">
              {footerCategoryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className={footerLinkClassName}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-sm font-semibold text-white">Help</h3>
            <ul className="mt-4 space-y-3">
              {siteFooterNavLinks.help.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              {siteFooterNavLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 space-y-4 border-t border-white/15 pt-8">
          <div className="flex justify-center">
            <Link
              href="/protection-policy"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-white/15",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-white/90" aria-hidden />
              Every order protected by Reswell Purchase Protection
            </Link>
          </div>
          <div className="space-y-1.5 text-center text-sm text-white/75">
            <p>
              Copyright {new Date().getFullYear()} Reswell. All rights reserved.
            </p>
            <MadeWithLoveSantaBarbara />
          </div>
        </div>
      </div>
    </footer>
  )
}
