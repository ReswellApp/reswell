import { HelpCenterPage } from "@/components/features/help-center/help-center-page"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("help")
}

export default function HelpPage() {
  return <HelpCenterPage />
}
