import { careerRoleTypeLabel, getCareerRoleBySlug } from "@/lib/careers"
import { brandShareImageResponse } from "@/lib/og/brand-share-image"
import { careerShareImageResponse, CAREER_OG_SIZE } from "@/lib/og/career-share-image"

export const runtime = "nodejs"
export const size = CAREER_OG_SIZE
export const contentType = "image/png"
export const alt = "Now hiring at Reswell"

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const role = getCareerRoleBySlug(slug)
  if (!role) {
    return brandShareImageResponse({
      headline: "Careers at Reswell",
      subhead: "Open roles in Santa Barbara.",
      footer: "reswell.app · Careers",
      tone: "dark",
    })
  }

  return careerShareImageResponse({
    eyebrow: `Now hiring · ${role.department}`,
    headline: role.title,
    subhead: `${role.location} · ${careerRoleTypeLabel(role)}`,
  })
}
