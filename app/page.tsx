import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowRight,
  MapPin,
  Shield,
  MessageSquare,
  Recycle,
  Users,
  Store,
} from "lucide-react"
import { MessageListingButton } from "@/components/message-listing-button"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { VerifiedBadge } from "@/components/verified-badge"

const categories = [
  { name: "Surfboards", href: "/boards" },
  { name: "Wetsuits", href: "/used/wetsuits" },
  { name: "Apparel & Lifestyle", href: "/used/apparel-lifestyle" },
  { name: "Fins", href: "/used/fins" },
  { name: "Leashes", href: "/used/leashes" },
  { name: "Board Bags", href: "/used/board-bags" },
  { name: "Collectibles & Vintage", href: "/used/collectibles-vintage" },
]

const features = [
  {
    icon: Recycle,
    title: "Sustainable Surfing",
    description: "Give your gear a second life and reduce waste in the surfing community.",
  },
  {
    icon: Shield,
    title: "Secure Transactions",
    description: "Protected payments and verified sellers for peace of mind.",
  },
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description: "Chat directly with buyers and sellers to ask questions and negotiate.",
  },
  {
    icon: MapPin,
    title: "Local Pickup",
    description: "Find surfboards near you for in-person inspection and pickup.",
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  
  // Fetch featured used listings - prioritize top sellers
  const { data: rawFeaturedUsed } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url),
      profiles (display_name, avatar_url, sales_count, shop_verified)
    `)
    .eq("status", "active")
    .eq("section", "used")
    .order("created_at", { ascending: false })
    .limit(20)

  // Sort by seller sales_count descending, then recency, and take top 4
  const featuredUsed = rawFeaturedUsed
    ? [...rawFeaturedUsed]
        .sort((a, b) => {
          const salesA = a.profiles?.sales_count ?? 0
          const salesB = b.profiles?.sales_count ?? 0
          if (salesB !== salesA) return salesB - salesA
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        .slice(0, 4)
    : null

  // Fetch featured new items
  const { data: featuredNew } = await supabase
    .from("inventory")
    .select("*")
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false })
    .limit(4)

  // Fetch featured shops - public profile fields only; never expose email or role flags
  const profilePublicFields =
    "id, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"
  const { data: featuredShops } = await supabase
    .from("profiles")
    .select(profilePublicFields)
    .eq("is_shop", true)
    .order("sales_count", { ascending: false })
    .order("shop_verified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4)

  // Fetch featured boards (in-person only) - prioritize top sellers
  const { data: rawFeaturedBoards } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url),
      profiles (display_name, avatar_url, location, sales_count, shop_verified)
    `)
    .eq("status", "active")
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(20)

  const featuredBoards = rawFeaturedBoards
    ? [...rawFeaturedBoards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4)
    : null

  const { data: { user } } = await supabase.auth.getUser()
  const featuredListingIds = [
    ...(featuredUsed ?? []).map((l) => l.id),
    ...(featuredBoards ?? []).map((b) => b.id),
  ]
  let favoritedIds: string[] = []
  if (user && featuredListingIds.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", featuredListingIds)
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[420px] md:min-h-[520px] flex items-center overflow-hidden">
          <HeroSlideshow />
          <div className="absolute inset-0 bg-white/55" aria-hidden />
          <div className="container mx-auto relative z-10 py-20 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4 hover:bg-secondary/70">
                The Surf Community Marketplace
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl text-balance">
                Buy and Sell Surf Gear with the Community
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-pretty">
                Join thousands of surfers buying and selling quality used gear, 
                shopping new accessories, and finding local surfboards.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/used">
                    Browse Used Gear
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/sell">Start Selling</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Marketplace Sections */}
        <section className="py-16">
          <div className="container mx-auto">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Used Gear */}
              <Card className="group relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Recycle className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">Used Gear</h3>
                  <p className="mt-2 text-muted-foreground">
                    Peer-to-peer marketplace for pre-loved surf accessories. Great deals on quality gear.
                  </p>
                  <Button variant="link" className="mt-4 p-0" asChild>
                    <Link href="/used">
                      Browse Used
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Surfboards */}
              <Card className="group relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-black text-white">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">Surfboards</h3>
                  <p className="mt-2 text-muted-foreground">
                    Find surfboards in your area for in-person pickup. Inspect before you buy.
                  </p>
                  <Button variant="link" className="mt-4 p-0" asChild>
                    <Link href="/boards">
                      Find Boards
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Sellers */}
              <Card className="group relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Store className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">Sellers</h3>
                  <p className="mt-2 text-muted-foreground">
                    Browse local surf sellers and retail stores listing their inventory.
                  </p>
                  <Button variant="link" className="mt-4 p-0" asChild>
                    <Link href="/sellers">
                      Browse Sellers
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 bg-offwhite">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Browse by Category</h2>
              <Button variant="ghost" asChild>
                <Link href="/used">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {categories.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="group flex flex-col items-center justify-center rounded-xl bg-muted p-4 text-center transition-all hover:bg-primary/5 hover:shadow-md min-h-[80px]"
                >
                  <span className="text-sm font-medium">{category.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Ocean images */}
        <section className="py-6 md:py-8">
          <div className="container mx-auto max-w-4xl md:max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                <img
                  src="/images/home/wave-1.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                <img
                  src="/images/home/wave-2.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                <img
                  src="/images/home/wave-3.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                <img
                  src="/images/home/wave-4.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Featured Sellers */}
        {featuredShops && featuredShops.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Featured Sellers</h2>
                  <p className="text-muted-foreground">Browse gear from local retail stores</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sellers">
                    All Sellers
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredShops.map((shop) => (
                  <Link key={shop.id} href={`/sellers/${shop.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                      <div className="h-20 bg-offwhite relative">
                        {shop.shop_banner_url && (
                          <img
                            src={shop.shop_banner_url || "/placeholder.svg"}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-end gap-3 -mt-6 mb-3">
                          <Avatar className="h-12 w-12 border-2 border-card">
                            <AvatarImage src={shop.shop_logo_url || shop.avatar_url || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {(shop.shop_name || shop.display_name || "S").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {shop.shop_verified && (
                            <VerifiedBadge size="md" className="-ml-1 mb-0.5" />
                          )}
                        </div>
                        <h3 className="font-semibold line-clamp-1 text-foreground">
                          {shop.shop_name || shop.display_name}
                        </h3>
                        {(shop.city || shop.shop_address) && (
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground line-clamp-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {shop.shop_address || shop.city}
                          </p>
                        )}
                        {shop.shop_description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {shop.shop_description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Used Gear */}
        {featuredUsed && featuredUsed.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Featured Used Gear</h2>
                  <p className="text-muted-foreground">Pre-loved items from the community</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/used">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredUsed.map((listing) => (
                  <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                    <Link href={`/used/${listing.slug || listing.id}`} className="flex-1 flex flex-col">
                      <div className="aspect-square relative bg-muted overflow-hidden">
                        {listing.listing_images?.[0]?.url ? (
                          <Image
                            src={listing.listing_images[0].url || "/placeholder.svg"}
                            alt={capitalizeWords(listing.title)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                        <FavoriteButtonCardOverlay
                          listingId={listing.id}
                          initialFavorited={favoritedIds.includes(listing.id)}
                          isLoggedIn={!!user}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{capitalizeWords(listing.title)}</h3>
                        <p className="text-lg font-bold text-primary mt-1">
                          ${listing.price.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          {getPublicSellerDisplayName(listing.profiles)}
                          {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                        </p>
                      </CardContent>
                    </Link>
                    <div className="px-4 pb-4 pt-0">
                      <MessageListingButton
                        listingId={listing.id}
                        sellerId={listing.user_id}
                        redirectPath={`/used/${listing.slug || listing.id}`}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured New Gear */}
        {featuredNew && featuredNew.length > 0 && (
          <section className="py-16 bg-offwhite">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">New Arrivals</h2>
                  <p className="text-muted-foreground">Fresh gear from our store</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    Shop All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredNew.map((item) => (
                  <Link key={item.id} href={`/shop/${item.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square relative bg-muted">
                        {item.image_url ? (
                          <Image
                            src={item.image_url || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-contain group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-lg font-bold text-primary">
                            ${item.price.toFixed(2)}
                          </p>
                          {item.compare_at_price && item.compare_at_price > item.price && (
                            <p className="text-sm text-muted-foreground line-through">
                              ${item.compare_at_price.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Surfboards */}
        {featuredBoards && featuredBoards.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
                  <p className="text-muted-foreground">In-person pickup only</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/boards">
                    Find More
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredBoards.map((board) => (
                  <Card key={board.id} className="group overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                    <Link href={`/boards/${board.slug || board.id}`} className="flex-1 flex flex-col">
                      <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                        {board.listing_images?.[0]?.url ? (
                          <Image
                            src={board.listing_images[0].url || "/placeholder.svg"}
                            alt={capitalizeWords(board.title)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                        <FavoriteButtonCardOverlay
                          listingId={board.id}
                          initialFavorited={favoritedIds.includes(board.id)}
                          isLoggedIn={!!user}
                        />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{capitalizeWords(board.title)}</h3>
                        <p className="text-lg font-bold text-primary mt-1">
                          ${board.price.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[board.city, board.state].filter(Boolean).join(", ") || "Location not set"}
                        </div>
                      </CardContent>
                    </Link>
                    <div className="px-4 pb-4 pt-0">
                      <MessageListingButton
                        listingId={board.id}
                        sellerId={board.user_id}
                        redirectPath={`/boards/${board.slug || board.id}`}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Features */}
        <section className="py-16 bg-primary/5">
          <div className="container mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">Why Choose Reswell?</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <feature.icon className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container mx-auto">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold">Ready to Ride the Wave?</h2>
              <p className="mt-4 text-muted-foreground">
                Join our community of surfers and start buying, selling, or trading today.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth/sign-up">Create Account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/used">Start Browsing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
