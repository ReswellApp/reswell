import type { ReactNode } from "react"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Order — Admin — Reswell",
    description: "Review payment, shipping, and support history for this Reswell marketplace order.",
    path: `/admin/orders/${id}`,
  })
}

export default function AdminOrderDetailLayout({ children }: { children: ReactNode }) {
  return children
}
