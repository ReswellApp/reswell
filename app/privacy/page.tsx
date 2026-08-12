import { Shield } from "lucide-react"
import { PrivacyPolicyContent } from "@/components/features/legal/privacy-policy-content"
import { formatLegalLastUpdated } from "@/components/features/legal/legal-prose-classes"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("privacy")
}

export default function PrivacyPolicyPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
            <p className="mt-1 text-muted-foreground">
              Last updated: {formatLegalLastUpdated()}
            </p>
          </div>
        </div>

        <PrivacyPolicyContent />
      </div>
    </main>
  )
}
