import { notFound } from "next/navigation"
import { CareerApplyPageContent } from "@/components/features/careers/career-apply-page-content"
import { careerRoleApplyHref, careerRoles, getCareerRoleBySlug } from "@/lib/careers"
import { pageSeoMetadata } from "@/lib/site-metadata"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return careerRoles.map((role) => ({ slug: role.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)
  if (!role) return {}
  return pageSeoMetadata({
    title: `Apply — ${role.title} | Careers at Reswell`,
    description: role.summary,
    path: careerRoleApplyHref(role),
  })
}

export default async function CareerRoleApplyPage({ params }: PageProps) {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)
  if (!role) notFound()

  return <CareerApplyPageContent role={role} />
}
