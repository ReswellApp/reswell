/** @deprecated Import from `@/lib/help-center/registry`, `paths`, or `top-articles` instead. */
export { HELP_CENTER_ACCENT } from "@/lib/help-center/paths"
export { getHelpCenterTabs, filterHelpCenterArticles, getAllHelpArticles } from "@/lib/help-center/registry"
export { helpCenterTopArticlesByTab } from "@/lib/help-center/top-articles"

export const helpCenterAdditionalResources = [
  { title: "Get help from the team", href: "/support", highlight: true },
  { title: "Purchase Protection", href: "/protection-policy" },
  { title: "Return Policy", href: "/return-policy" },
  { title: "Shipping guide", href: "/shipping" },
  { title: "We’ll buy your surfboard", href: "/we-buy" },
  { title: "Board Finder", href: "/board-finder" },
  { title: "Sell on Reswell", href: "/sell" },
  { title: "Seller Resources", href: "/seller-resources" },
  { title: "Safety tips", href: "/safety" },
  { title: "FAQs", href: "/faq" },
  { title: "Terms & Policies", href: "/terms" },
  { title: "Contact", href: "/contact" },
] as const
