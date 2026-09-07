import { FileText } from "lucide-react"
import { TermsOfServiceContent } from "@/components/features/legal/terms-of-service-content"
import { formatLegalLastUpdated } from "@/components/features/legal/legal-prose-classes"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("terms")
}

export default function TermsOfServicePage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <FileText className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
            <p className="mt-1 text-muted-foreground">
              Last updated: {formatLegalLastUpdated()}
            </p>
          </div>
        </div>

        <TermsOfServiceContent />
      </div>
    </main>
  )
}
