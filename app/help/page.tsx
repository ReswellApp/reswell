import { HelpCenterPage } from "@/components/features/help-center/help-center-page"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Help Center — Reswell",
  description:
    "Search articles and guides for buying, selling, and managing your Reswell account.",
  path: "/help",
  robots: { index: true, follow: true },
})

export default function HelpPage() {
  return <HelpCenterPage />
}
