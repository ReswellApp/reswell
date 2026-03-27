import Link from "next/link"
import Image from "next/image"
import reswellLogo from "@/public/images/reswell-logo.png"

const footerLinks = {
  marketplace: [
    { name: "Surfboards", href: "/boards" },
    { name: "All Gear", href: "/used" },
    { name: "Sell Your Gear", href: "/sell" },
    { name: "Sellers", href: "/sellers" },
  ],
  categories: [
    { name: "Surfboards", href: "/used?category=surfboards" },
    { name: "Wetsuits", href: "/used/wetsuits" },
    { name: "Apparel & Lifestyle", href: "/used/apparel-lifestyle" },
    { name: "Fins", href: "/used/fins" },
    { name: "Surfpacks & Bags", href: "/used/backpacks" },
    { name: "Board Bags", href: "/used/board-bags" },
    { name: "Accessories", href: "/used?category=accessories" },
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
                src={reswellLogo}
                alt="Reswell logo"
                className="h-28 w-auto sm:h-32 md:h-40"
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

        <div className="mt-12 border-t border-lightgray pt-8">
          <p className="text-center text-sm text-midgray">
            {new Date().getFullYear()} Reswell. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
