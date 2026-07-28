/** @deprecated Import from `@/lib/help-center/registry`, `paths`, or `top-articles` instead. */
export { HELP_CENTER_ACCENT } from "@/lib/help-center/paths"
export { getHelpCenterTabs, filterHelpCenterArticles, getAllHelpArticles } from "@/lib/help-center/registry"
export { helpCenterTopArticlesByTab } from "@/lib/help-center/top-articles"

export const helpCenterAdditionalResources = [
  { title: "Terms & Policies", href: "/terms" },
  { title: "Shipping Resources", href: "/shipping" },
  { title: "Recently sold", href: "/sold" },
  { title: "Sales tax information", href: "/contact", highlight: true },
  { title: "Reswell Purchase Protection", href: "/protection-policy" },
  { title: "Blog", href: "/blog" },
  { title: "Sell on Reswell", href: "/sell" },
  { title: "Safety tips", href: "/safety" },
] as const
