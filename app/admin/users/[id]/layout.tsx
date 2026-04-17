import type { ReactNode } from "react"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "User — Admin — Reswell",
    description: "Review account details, listings, and support actions for this Reswell user.",
    path: `/admin/users/${id}`,
  })
}

export default function AdminUserDetailLayout({ children }: { children: ReactNode }) {
  return children
}
