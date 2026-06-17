import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"

/**
 * Thread routes are a fixed-height app shell with a bottom-pinned composer.
 * `resizes-content` shrinks the layout viewport (and `dvh`) when the on-screen
 * keyboard opens, so the composer stays visible above it instead of being
 * covered. Scoped to the thread route only.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
}

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
