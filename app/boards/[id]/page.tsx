import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatBoardType, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { ShareButton } from "@/components/share-button"
import { EndListingButton } from "@/components/end-listing-button"
import {
  ArrowLeft,
  MapPin,
  MessageSquare,
  Share2,
  Clock,
  AlertTriangle,
  Ruler,
  Info,
} from "lucide-react"
import { ImageGallery } from "@/components/image-gallery"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import { LocationMap } from "@/components/location-map"
import { TranslateableDescription } from "@/components/translateable-description"
export default async function BoardDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  
  const { data: board } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (id, url, is_primary),
      profiles (id, display_name, avatar_url, location, created_at)
    `)
    .eq("id", params.id)
    .eq("section", "surfboards")
    .single()

  if (!board) {
    notFound()
  }

  // Ensure seller profile never contains private data (email, etc.) before sending to client
  const p = board.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    board.profiles = {
      id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      location: p.location,
      created_at: p.created_at,
    }
  }

  // Get seller's other boards
  const { data: sellerBoards } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      price,
      board_length,
      listing_images (url, is_primary)
    `)
    .eq("user_id", board.user_id)
    .eq("status", "active")
    .eq("section", "surfboards")
    .neq("id", board.id)
    .limit(4)

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Check if favorited
  let isFavorited = false
  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", board.id)
      .single()
    isFavorited = !!favorite
  }

  const images = board.listing_images?.sort((a: { is_primary: boolean }, b: { is_primary: boolean }) => 
    (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
  ) || []

  const isOwnListing = user?.id === board.user_id

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/boards" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Surfboards
            </Link>
            {board.board_type && (
              <>
                <span>/</span>
                <Link
                  href={`/boards?type=${board.board_type}`}
                  className="hover:text-foreground capitalize"
                >
                  {board.board_type}
                </Link>
              </>
            )}
          </div>

          {/* Mobile heading + actions above images */}
          <div className="mb-2 lg:hidden flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold break-words flex-1">
              {capitalizeWords(board.title)}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <FavoriteButton
                listingId={board.id}
                initialFavorited={isFavorited}
                isLoggedIn={!!user}
              />
              <ShareButton title={capitalizeWords(board.title)} />
            </div>
          </div>

          {/* Mobile price + tags above images */}
          <div className="mb-4 lg:hidden">
            <p className="text-2xl font-bold text-primary">
              ${board.price.toFixed(2)}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">{formatCondition(board.condition)}</Badge>
              {board.board_type && (
                <Badge variant="outline">{formatBoardType(board.board_type)}</Badge>
              )}
              {board.board_length && (
                <Badge variant="outline">
                  <Ruler className="h-3 w-3 mr-1" />
                  {board.board_length}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Images */}
            <div>
              <ImageGallery images={images} title={capitalizeWords(board.title)} />
            </div>

            {/* Details */}
            <div className="space-y-4 min-w-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <h1 className="hidden lg:block text-xl font-bold sm:text-2xl break-words">
                    {capitalizeWords(board.title)}
                  </h1>
                  <div className="hidden lg:flex items-center gap-2 shrink-0">
                    <FavoriteButton
                      listingId={board.id}
                      initialFavorited={isFavorited}
                      isLoggedIn={!!user}
                    />
                    <ShareButton title={capitalizeWords(board.title)} />
                  </div>
                </div>
                <p className="hidden lg:block text-2xl sm:text-3xl font-bold text-primary mt-2">
                  ${board.price.toFixed(2)}
                </p>
              </div>

              {/* Board Specs */}
              <div className="hidden lg:flex flex-wrap gap-2">
                <Badge variant="secondary">{formatCondition(board.condition)}</Badge>
                {board.board_type && (
                  <Badge variant="outline">{formatBoardType(board.board_type)}</Badge>
                )}
                {board.board_length && (
                  <Badge variant="outline">
                    <Ruler className="h-3 w-3 mr-1" />
                    {board.board_length}
                  </Badge>
                )}
              </div>

              {/* Description (above map) */}
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <TranslateableDescription text={board.description || ""} />
              </div>

              {/* Location (map above contact seller) */}
              <Card className="bg-primary/5 border-primary/20 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="h-5 w-5" />
                    <span className="font-medium">
                      {board.city && board.state
                        ? `${board.city}, ${board.state}`
                        : board.profiles?.location || "Location not specified"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Approximate pickup area for meeting the seller. This surfboard is available for local pickup only.
                  </p>
                  {board.latitude && board.longitude ? (
                    <LocationMap
                      lat={parseFloat(board.latitude)}
                      lng={parseFloat(board.longitude)}
                      label={
                        board.city && board.state
                          ? `${board.city}, ${board.state}`
                          : "Pickup Location"
                      }
                      showDirections
                      height={280}
                    />
                  ) : board.profiles?.location ? (
                    <div className="h-[200px] rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      <MapPin className="h-5 w-5 mr-2" />
                      {board.profiles.location}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Contact Form */}
              {!isOwnListing && (
                <Card className="bg-offwhite">
                  <CardContent className="p-4">
                    <ContactSellerForm
                      listingId={board.id}
                      sellerId={board.user_id}
                      listingTitle={capitalizeWords(board.title)}
                      isLoggedIn={!!user}
                    />
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Seller Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    <Link
                      href={`/sellers/${board.profiles?.id}`}
                      className="flex items-center gap-4"
                    >
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={board.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {getPublicSellerDisplayName(board.profiles).charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {getPublicSellerDisplayName(board.profiles)}
                        </p>
                        {board.profiles?.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {board.profiles.location}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          Member since{" "}
                          {new Date(board.profiles?.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </Link>
                    {!isOwnListing && (
                      <div className="flex flex-row gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="min-h-touch flex-1 justify-center"
                        >
                          <Link
                            href={
                              user
                                ? `/messages?user=${board.user_id}&listing=${board.id}`
                                : `/auth/login?redirect=${encodeURIComponent(`/boards/${board.id}`)}`
                            }
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message seller
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="min-h-touch flex-1 justify-center"
                        >
                          <Link href={`/sellers/${board.profiles?.id}`}>
                            View Profile
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {isOwnListing && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">This is your listing</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button asChild>
                        <Link href={`/dashboard/listings/${board.id}/edit`}>
                          Edit listing
                        </Link>
                      </Button>
                      <EndListingButton listingId={board.id} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Safety Tips */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Info className="h-4 w-4 text-primary" />
                  Meeting Tips for Board Pickups
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>Meet in a public place like a beach parking lot</li>
                  <li>Bring a friend if possible</li>
                  <li>Check for cracks, dings, and delamination</li>
                  <li>Test the flex and check fin boxes</li>
                  <li>Use cash or a secure payment app</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seller's Other Boards */}
          {sellerBoards && sellerBoards.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold mb-6">More Boards from this Seller</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {sellerBoards.map((item) => {
                  const primaryImage = item.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || item.listing_images?.[0]
                  return (
                    <Link key={item.id} href={`/boards/${item.id}`}>
                      <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="aspect-[4/5] relative bg-muted">
                          {primaryImage?.url ? (
                            <Image
                              src={primaryImage.url || "/placeholder.svg"}
                              alt={item.title}
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
                          <h3 className="font-medium line-clamp-1">{item.title}</h3>
                          {item.board_length && (
                            <p className="text-sm text-muted-foreground">{item.board_length}</p>
                          )}
                          <p className="text-lg font-bold text-primary mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
