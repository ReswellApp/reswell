import Link from "next/link"

const footerLinks = {
  marketplace: [
    { name: "Used Gear", href: "/used" },
    { name: "New Gear", href: "/shop" },
    { name: "Surfboards", href: "/boards" },
    { name: "Sell Your Gear", href: "/sell" },
    { name: "Sellers", href: "/sellers" },
  ],
  categories: [
    { name: "Surfboards", href: "/used?category=surfboards" },
    { name: "Wetsuits", href: "/used?category=wetsuits" },
    { name: "Fins", href: "/used?category=fins" },
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cerulean text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                  <path d="M2 19c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                  <path d="M2 5c.6.5 1.2 1 2.5 1C7 6 7 4 9.5 4c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                </svg>
              </div>
              <span className="text-xl font-bold text-black">ReSwell Surf</span>
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
                    className="text-sm text-midgray hover:text-cerulean transition-colors duration-smooth"
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
                    className="text-sm text-midgray hover:text-cerulean transition-colors duration-smooth"
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
                    className="text-sm text-midgray hover:text-cerulean transition-colors duration-smooth"
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
                    className="text-sm text-midgray hover:text-cerulean transition-colors duration-smooth"
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
            {new Date().getFullYear()} ReSwell Surf. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
