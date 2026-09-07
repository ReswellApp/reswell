import { RESWELL_CONTACT_EMAIL, RESWELL_CONTACT_MAILTO } from "@/lib/constants/contact"

export type CareerRoleType = "Full-time" | "Part-time" | "Contract"

export type CareerRoleSection = {
  heading: string
  body?: string
  items?: readonly string[]
}

export type CareerRole = {
  title: string
  slug: string
  location: string
  department: string
  types: readonly CareerRoleType[]
  reportsTo: string
  summary: string
  about: string
  sections: readonly CareerRoleSection[]
  applyIntro: string
  applyItems: readonly string[]
  applyNote?: string
  photos?: readonly CareerRolePhoto[]
}

export type CareerRolePhoto = {
  src: string
  alt: string
  caption: string
  /** First photo is landscape and spans both columns. */
  wide?: boolean
}

/** Listed openings. Footer Careers links and `/careers` both read from this. */
export const careerRoles: readonly CareerRole[] = [
  {
    title: "Surfboard Buyer & Operations Associate",
    slug: "surfboard-buyer-operations-associate",
    location: "Santa Barbara, CA",
    department: "Operations",
    types: ["Part-time", "Full-time"],
    reportsTo: "Hayden Garfield, Cofounder",
    summary: "Buy boards, get them ready, list and ship them.",
    about:
      "Reswell is a used-surfboard marketplace. We also run Hayden's Board Shop — boards we buy, clean up, and sell ourselves.",
    sections: [
      {
        heading: "The role",
        body: "You'll own buying and selling: find boards, pay fairly, and get them ready to sell. A lot of the week is driving the coast to meet sellers. The rest is in the shop — dewax, photo, list, pack. If you'd rather be around boards than a desk, this fits.",
      },
      {
        heading: "What you'll do",
        items: [
          "Buy boards around Santa Barbara, Ventura, Carpinteria, and nearby towns",
          "Message Facebook Marketplace listings fast and keep a pipeline going",
          "Dewax, clean, and note condition",
          "Photograph and list on Marketplace and Reswell",
          "Pack and ship so boards arrive the same way they left",
          "Track what sells and for how much",
        ],
      },
      {
        heading: "What we're looking for",
        items: [
          "You surf and can price a board",
          "Comfortable talking to strangers and negotiating",
          "Self-directed — you'll make the drives and send the messages",
          "License and a vehicle that can carry boards (mileage reimbursed)",
          "Careful with fragile boards",
        ],
      },
      {
        heading: "Nice to have",
        items: [
          "Buying and reselling experience",
          "Ding repair or glassing",
          "Decent phone photos",
          "Local surf community connections",
        ],
      },
      {
        heading: "What we offer",
        items: [
          "Hourly pay (we'll share the rate when we talk)",
          "Mileage reimbursement",
          "Flexible schedule, including around swell when we can",
          "Employee pricing on boards",
        ],
      },
    ],
    applyIntro: "Email us with:",
    applyItems: [
      "A short note on your surfing and any buying/reselling experience",
      "Your favorite board you've owned and why",
    ],
    applyNote: "No resume required. We care more about whether you know boards.",
    photos: [
      {
        src: "/images/careers/role-packed.jpg",
        alt: "A Pyzel surfboard wrapped in honeycomb packing paper against a shop door",
        caption: "Packed",
        wide: true,
      },
      {
        src: "/images/careers/role-shop.jpg",
        alt: "Two boxed surfboards waiting outside the Santa Barbara shop",
        caption: "Out the door",
      },
      {
        src: "/images/careers/role-break.jpg",
        alt: "A Hayden Shapes board, towel, and trunks on the rocks between sessions",
        caption: "Between runs",
      },
    ],
  },
]

export function getCareerRoleBySlug(slug: string): CareerRole | undefined {
  return careerRoles.find((role) => role.slug === slug)
}

export function careerRoleTypeLabel(role: CareerRole): string {
  return role.types.join(" / ")
}

export function careerRoleHref(role: CareerRole): string {
  return `/careers/${role.slug}`
}

export const CAREERS_APPLY_EMAIL = RESWELL_CONTACT_EMAIL

export function careerRoleApplyMailto(role: CareerRole): string {
  return `${RESWELL_CONTACT_MAILTO}?subject=${encodeURIComponent(role.title)}`
}

export const CAREERS_APPLY_MAILTO =
  `${RESWELL_CONTACT_MAILTO}?subject=${encodeURIComponent("Careers at Reswell")}` as const
