import { redirect } from "next/navigation"

export default async function DashboardListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/sell?edit=${id}`)
}
