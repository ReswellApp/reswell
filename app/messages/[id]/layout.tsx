import type { ReactNode } from "react"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Conversation — Reswell",
    description:
      "Continue a Reswell message thread about a listing, offer, shipping, or local pickup.",
    path: `/messages/${id}`,
  })
}

export default function MessageThreadLayout({ children }: { children: ReactNode }) {
  return children
}
