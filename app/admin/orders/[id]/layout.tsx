import type { ReactNode } from "react"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Order — Admin — Reswell",
    description: "See what this order needs next — fulfillment, payment, and support.",
    path: `/admin/orders/${id}`,
  })
}

export default function AdminOrderDetailLayout({ children }: { children: ReactNode }) {
  return children
}
