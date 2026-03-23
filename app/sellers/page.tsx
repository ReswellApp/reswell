import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Store,
  ExternalLink,
  Search,
  ArrowRight,
  Package,
} from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"

export const metadata = {
  title: "Sellers - Reswell",
  description:
    "Browse local surf sellers and retail stores on Reswell. Find verified sellers near you.",
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  // Public fields only; never expose email or role flags
  const profilePublicFields =
    "id, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"
  let query = supabase
    .from("profiles")
    .select(profilePublicFields)
    .eq("is_shop", true)
    .order("sales_count", { ascending: false })
    .order("shop_verified", { ascending: false })
    .order("created_at", { ascending: false })

  if (q) {
    query = query.or(
      `shop_name.ilike.%${q}%,shop_description.ilike.%${q}%,city.ilike.%${q}%,shop_address.ilike.%${q}%`
    )
  }

  const { data: shops } = await query

  return (
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Store className="h-6 w-6" />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                Sellers
              </h1>
              <p className="mt-3 text-muted-foreground text-pretty">
                Browse retail surf sellers listing their inventory on Reswell.
                Find gear from verified local stores.
              </p>
            </div>

            {/* Search */}
            <form
              action="/sellers"
              method="GET"
              className="mx-auto mt-8 flex max-w-lg items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={q || ""}
                  placeholder="Search sellers by name or location..."
                  className="pl-10"
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </div>
        </section>

        {/* Results */}
        <section className="py-12">
          <div className="container mx-auto">
            {q && (
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {shops?.length || 0} seller{shops?.length !== 1 ? "s" : ""}{" "}
                  found{q ? ` for "${q}"` : ""}
                </p>
                {q && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sellers">Clear search</Link>
                  </Button>
                )}
              </div>
            )}

            {!shops || shops.length === 0 ? (
              <div className="mx-auto max-w-md text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  No sellers found
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {q
                    ? "Try adjusting your search terms."
                    : "No sellers have registered yet. Be the first!"}
                </p>
                {!q && (
                  <Button className="mt-6" asChild>
                    <Link href="/dashboard/settings">Register as a Seller</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shops.map((shop) => (
                  <Link key={shop.id} href={`/sellers/${shop.id}`}>
                    <Card className="group h-full overflow-hidden hover:shadow-lg transition-all hover:border-primary/30">
                      {/* Banner */}
                      <div className="relative h-28 bg-offwhite">
                        {shop.shop_banner_url && (
                          <img
                            src={shop.shop_banner_url || "/placeholder.svg"}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                        {/* Avatar overlapping banner */}
                        <div className="absolute -bottom-8 left-4">
                          <Avatar className="h-16 w-16 border-4 border-card">
                            <AvatarImage
                              src={shop.shop_logo_url || shop.avatar_url || ""}
                            />
                            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                              {(shop.shop_name || shop.display_name || "S")
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>

                      <CardContent className="pt-10 pb-5 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-foreground truncate">
                                {shop.shop_name || shop.display_name}
                              </h3>
                              {shop.shop_verified && (
                                <VerifiedBadge size="md" />
                              )}
                            </div>
                            {(shop.city || shop.shop_address) && (
                              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                {shop.shop_address || shop.city}
                              </p>
                            )}
                          </div>
                          {shop.shop_verified && (
                            <Badge
                              variant="secondary"
                              className="flex-shrink-0 bg-blue-50 text-blue-700 border-blue-200"
                            >
                              <VerifiedBadge size="sm" className="mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>

                        {shop.shop_description && (
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                            {shop.shop_description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          {shop.shop_website && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ExternalLink className="h-3 w-3" />
                              Website
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                            View Seller
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA for shop owners */}
        <section className="py-16 bg-offwhite">
          <div className="container mx-auto">
            <div className="mx-auto max-w-2xl text-center">
              <Package className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">
                Want to Sell on Reswell?
              </h2>
              <p className="mt-3 text-muted-foreground text-pretty">
                List your store inventory on Reswell and reach thousands of
                local surfers. Set up your seller profile in minutes.
              </p>
              <Button className="mt-6" size="lg" asChild>
                <Link href="/dashboard/settings">
                  Become a Seller
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
  )
}
