import { notFound } from "next/navigation"

import { CoastalJoinForm } from "@/components/features/admin/coastal-delivery/coastal-join-form"
import { getCoastalJoinState } from "@/lib/services/coastalDelivery"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Join coastal delivery — Admin — Reswell",
  description: "Preview the coastal shipper join flow.",
  path: "/admin/coastal-delivery/join",
})

export default async function CoastalDeliveryJoinPage() {
  const loaded = await getCoastalJoinState()
  if (!loaded.ok) notFound()

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{loaded.data.profile ? "Your shipper profile" : "Join as a shipper"}</h2>
      <CoastalJoinForm profile={loaded.data.profile} />
    </section>
  )
}
