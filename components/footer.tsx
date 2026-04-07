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
    { name: "Browse by shape", href: "/categories" },
    { name: "Search listings", href: "/search/recent" },
    { name: "Shop (new)", href: "/shop" },
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
    <footer className="border-t border-lightgray bg-softwhite transition-colors duration-smooth pb-[env(safe-area-inset-bottom)]">
      <div className="container mx-auto py-8 sm:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
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
            <p className="mt-4 text-sm text-midgray">
              The peer-to-peer marketplace for surfing enthusiasts. Buy, sell, and discover amazing surf gear.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="text-sm font-semibold text-black">Marketplace</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.marketplace.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className="text-sm text-midgray hover:text-black dark:hover:text-white transition-colors duration-smooth"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-black">Categories</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.categories.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-midgray hover:text-black dark:hover:text-white transition-colors duration-smooth"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-black">Support</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-midgray hover:text-black dark:hover:text-white transition-colors duration-smooth"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-black">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-midgray hover:text-black dark:hover:text-white transition-colors duration-smooth"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-lightgray pt-8 space-y-4">
          <div className="flex justify-center">
            <Link
              href="/protection-policy"
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors dark:border-green-800/50 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Every order protected by Reswell Purchase Protection
            </Link>
          </div>
          <div className="text-center text-sm text-midgray space-y-1">
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
