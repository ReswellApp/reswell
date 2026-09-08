import { CareerApplyPageContent } from "@/components/features/careers/career-apply-page-content"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Apply | Careers at Reswell",
  description: "Send a general application to Reswell. No resume required.",
  path: "/careers/apply",
})

export default function CareersGeneralApplyPage() {
  return <CareerApplyPageContent />
}
