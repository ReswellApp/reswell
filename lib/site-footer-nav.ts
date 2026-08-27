import { careerRoleHref, careerRoles } from "@/lib/careers"

/** Footer + mobile hamburger — single source of truth for these destinations. */

export type SiteFooterNavLink = { name: string; href: string }

export const siteFooterNavLinks: {
  marketplace: readonly SiteFooterNavLink[]
  help: readonly SiteFooterNavLink[]
  careers: readonly SiteFooterNavLink[]
  legal: readonly SiteFooterNavLink[]
} = {
  marketplace: [
    { name: "Shop from Reswell", href: "/reswell/shop" },
    { name: "Recently sold", href: "/sold" },
    { name: "Sell your gear", href: "/sell" },
    { name: "Sellers", href: "/sellers" },
    { name: "Cities", href: "/cities/top" },
    { name: "Surf shops", href: "/surf-shops" },
    { name: "Giveaways", href: "/giveaways" },
    { name: "Blog", href: "/blog" },
  ],
  help: [
    { name: "Why Reswell?", href: "/what-is-reswell" },
    { name: "FAQs", href: "/faq" },
    { name: "Reswell Protection", href: "/protection-policy" },
    { name: "Contact Support", href: "/contact" },
  ],
  careers: [
    { name: "Open roles", href: "/careers" },
    ...careerRoles.map((role) => ({ name: role.title, href: careerRoleHref(role) })),
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Return Policy", href: "/return-policy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Mobile Terms", href: "/mobile-terms" },
    { name: "Cookie Policy", href: "/cookies" },
  ],
}
