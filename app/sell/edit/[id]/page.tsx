import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Edit listing — Reswell",
    description: "Continue editing your surfboard listing on the Reswell sell flow.",
    path: `/sell/edit/${id}`,
  })
}

export default async function SellEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/sell?edit=${id}`)
}
