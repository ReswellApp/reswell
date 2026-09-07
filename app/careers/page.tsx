import { CareersPageContent } from "@/components/features/careers/careers-page-content"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 86400

export async function generateMetadata() {
  return resolvePageMetadata("careers")
}

export default function CareersPage() {
  return (
    <main className="flex-1">
      <CareersPageContent />
    </main>
  )
}
