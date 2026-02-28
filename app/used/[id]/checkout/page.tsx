import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { MessageListingButton } from "@/components/message-listing-button"

export default async function UsedCheckoutPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/used/${id}/checkout`)}`)
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, price, user_id, status")
    .eq("id", id)
    .eq("section", "used")
    .single()

  if (!listing || listing.status !== "active") {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-lg">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
            <Link href={`/used/${id}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to listing
            </Link>
          </Button>
          <h1 className="text-2xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground mb-6">
            {capitalizeWords(listing.title)} — ${Number(listing.price).toFixed(2)}
          </p>
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              To complete your purchase, message the seller to arrange payment and delivery.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <MessageListingButton
                listingId={listing.id}
                sellerId={listing.user_id}
                redirectPath={`/used/${id}/checkout`}
                size="default"
                variant="default"
                className="gap-2"
              />
              <Button variant="outline" asChild>
                <Link href={`/used/${id}`} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to listing
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
