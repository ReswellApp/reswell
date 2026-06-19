import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConsignmentStoreBySlug } from "@/lib/db/consignmentStores"
import { ConsignmentIntakeForm } from "@/components/features/consignment/consignment-intake-form"

export default async function ConsignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams
  const supabase = await createClient()

  const store = await getConsignmentStoreBySlug(supabase, slug)
  if (!store || store.status !== "active") {
    notFound()
  }

  // QR-gating is opt-in per store. Only when a shop explicitly requires its token do we restrict
  // intake to people who scanned the in-store QR; otherwise any signed-in user can consign.
  const tokenSatisfied =
    !store.requireIntakeToken || (!!store.intakeQrToken && t?.trim() === store.intakeQrToken)

  if (!tokenSatisfied) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Scan in store to consign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {store.name} accepts consignments from its in-store QR code. Visit the shop and scan the
          “Consign a board here” sign to list your board.
        </p>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const returnTo = t?.trim()
      ? `/stores/${slug}/consign?t=${encodeURIComponent(t.trim())}`
      : `/stores/${slug}/consign`
    redirect(`/auth/login?redirect=${encodeURIComponent(returnTo)}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{store.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Consign your board</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your board details below. The shop reviews each submission, sets the public asking
          price, and handles buyer messaging. You get paid to your Reswell wallet when it sells.
        </p>
      </div>

      <ConsignmentIntakeForm storeId={store.id} storeName={store.name} userId={user.id} />
    </div>
  )
}
