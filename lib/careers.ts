import { RESWELL_CONTACT_EMAIL, RESWELL_CONTACT_MAILTO } from "@/lib/constants/contact"

export type CareerRole = {
  title: string
  slug: string
  location: string
  type: "Full-time" | "Part-time" | "Contract"
  summary: string
}

/** Listed openings. Footer Careers links and `/careers` both read from this. */
export const careerRoles: readonly CareerRole[] = []

export function careerRoleHref(role: CareerRole): string {
  return `/careers#${role.slug}`
}

export const CAREERS_APPLY_EMAIL = RESWELL_CONTACT_EMAIL

export const CAREERS_APPLY_MAILTO =
  `${RESWELL_CONTACT_MAILTO}?subject=${encodeURIComponent("Careers at Reswell")}` as const
