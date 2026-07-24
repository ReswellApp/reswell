/** Footer + mobile hamburger — single source of truth for these destinations. */

export type SiteFooterNavLink = { name: string; href: string }

export const siteFooterNavLinks: {
  marketplace: readonly SiteFooterNavLink[]
  support: readonly SiteFooterNavLink[]
  legal: readonly SiteFooterNavLink[]
} = {
  marketplace: [
    { name: "Surfboards", href: "/boards" },
    { name: "Shop from Reswell", href: "/reswell/shop" },
    { name: "Recently sold", href: "/sold" },
    { name: "Sell your board", href: "/sell" },
    { name: "Sellers", href: "/sellers" },
    { name: "What is Reswell", href: "/what-is-reswell" },
    { name: "Blog", href: "/blog" },
  ],
  support: [
    { name: "Help Center", href: "/help" },
    { name: "FAQ", href: "/faq" },
    { name: "Purchase Protection", href: "/protection-policy" },
    { name: "Safety Tips", href: "/safety" },
    { name: "Shipping Guide", href: "/shipping" },
    { name: "Shipping label estimator", href: "/shipping-estimator" },
    { name: "Contact Us", href: "/contact" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Return Policy", href: "/return-policy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Mobile Terms", href: "/mobile-terms" },
    { name: "Cookie Policy", href: "/cookies" },
  ],
}
