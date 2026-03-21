import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { BoardCheckoutClient } from "@/components/board-checkout-client"

export default async function BoardCheckoutPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/boards/${id}/checkout`)}`)
  }

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price"
    )
    .eq("id", id)
    .eq("section", "surfboards")
    .single()

  if (!listing || listing.status !== "active") {
    notFound()
  }

  if (listing.user_id === user.id) {
    redirect(`/boards/${id}`)
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-lg">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
            <Link href={`/boards/${id}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to listing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold mb-1">Checkout</h1>
          <p className="text-muted-foreground mb-6">
            {capitalizeWords(listing.title)}
          </p>
          <BoardCheckoutClient listing={listing} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
