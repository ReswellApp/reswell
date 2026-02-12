'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShoppingBag, Package, MessageSquare, ArrowRight, ShoppingCart } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Purchase {
  id: string
  amount: number
  status: string
  created_at: string
  listing: {
    id: string
    title: string
    section: string
    listing_images: { url: string; is_primary: boolean }[]
  } | null
  seller?: { display_name: string | null } | null
  buyer?: { display_name: string | null } | null
}

interface CartOrder {
  id: string
  status: string
  subtotal: number
  shipping: number
  total: number
  created_at: string
  order_items: Array<{
    listing_id: string
    quantity: number
    price: number
    listing: { title: string; listing_images: { url: string; is_primary: boolean }[] } | null
  }>
}

export default function OrdersPage() {
  const [purchasesAsBuyer, setPurchasesAsBuyer] = useState<Purchase[]>([])
  const [salesAsSeller, setSalesAsSeller] = useState<Purchase[]>([])
  const [cartOrders, setCartOrders] = useState<CartOrder[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: bought, error: boughtError } = await supabase
      .from('purchases')
      .select(`
        id,
        amount,
        status,
        created_at,
        listing:listings(id, title, section, listing_images(url, is_primary))
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (!boughtError && bought) {
      setPurchasesAsBuyer(bought as unknown as Purchase[])
    }

    const { data: sold, error: soldError } = await supabase
      .from('purchases')
      .select(`
        id,
        amount,
        status,
        created_at,
        listing:listings(id, title, section, listing_images(url, is_primary))
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })

    if (!soldError && sold) {
      setSalesAsSeller(sold as unknown as Purchase[])
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        subtotal,
        shipping,
        total,
        created_at,
        order_items(
          listing_id,
          quantity,
          price,
          listing:listings(title, listing_images(url, is_primary))
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!ordersError && orders) {
      setCartOrders(orders as unknown as CartOrder[])
    }

    setLoading(false)
  }

  const getSectionHref = (section: string) => {
    if (section === 'board' || section === 'surfboards') return '/boards'
    return '/used'
  }

  const OrderCard = ({ p, showCounterparty }: { p: Purchase; showCounterparty: boolean }) => {
    const listing = p.listing
    const primaryImage = listing?.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || listing?.listing_images?.[0]
    const href = listing ? `${getSectionHref(listing.section)}/${listing.id}` : '#'
    const counterparty = showCounterparty ? (p.seller?.display_name ?? p.buyer?.display_name ?? null) : null

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link
              href={href}
              className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0"
            >
              {primaryImage?.url ? (
                <Image
                  src={primaryImage.url}
                  alt={listing?.title ?? 'Item'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={href} className="font-semibold text-foreground hover:text-primary line-clamp-2">
                {listing?.title ?? 'Listing'}
              </Link>
              <p className="text-lg font-bold text-primary mt-1">${Number(p.amount).toFixed(2)}</p>
              {counterparty && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {p.seller ? 'Seller: ' : 'Buyer: '}
                  {counterparty}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={p.status === 'confirmed' ? 'default' : 'secondary'}>
                  {p.status}
                </Badge>
                {listing && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/messages?listing=${listing.id}`}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0">
              <Link href={href} aria-label="View listing">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Orders</h1>
      <p className="text-muted-foreground mb-6">
        Purchases you made with ReSwell Bucks and sales you’ve received.
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-5 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="mb-6 flex-wrap gap-1">
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Single-item ({purchasesAsBuyer.length})
            </TabsTrigger>
            <TabsTrigger value="cart" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart orders ({cartOrders.length})
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <Package className="h-4 w-4" />
              My sales ({salesAsSeller.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="space-y-4">
            {purchasesAsBuyer.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium text-foreground">No purchases yet</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">
                    Items you buy with card, Apple Pay, or ReSwell Bucks will appear here.
                  </p>
                  <Button asChild>
                    <Link href="/used">Browse used gear</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              purchasesAsBuyer.map((p) => (
                <OrderCard key={p.id} p={p} showCounterparty={true} />
              ))
            )}
          </TabsContent>

          <TabsContent value="cart" className="space-y-4">
            {cartOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium text-foreground">No cart orders yet</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">
                    Orders from the shop cart (New Gear) will appear here.
                  </p>
                  <Button asChild>
                    <Link href="/shop">Browse new gear</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              cartOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">
                        Order #{String(order.id).slice(0, 8)} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </span>
                      <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </div>
                    <ul className="space-y-1 mb-3">
                      {(order.order_items || []).map((oi: { listing_id: string; quantity: number; price: number; listing: { title: string } | null }, idx: number) => (
                        <li key={oi.listing_id + idx} className="flex justify-between text-sm">
                          <Link href={`/shop/${oi.listing_id}`} className="hover:text-primary">
                            {oi.listing?.title ?? 'Item'} × {oi.quantity}
                          </Link>
                          <span>${(oi.price * oi.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-lg font-bold text-primary">
                      Total ${Number(order.total).toFixed(2)}
                      {Number(order.shipping) > 0 && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (incl. ${Number(order.shipping).toFixed(2)} shipping)
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            {salesAsSeller.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium text-foreground">No sales yet</p>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">
                    When someone buys your listing with ReSwell Bucks, it will show here.
                  </p>
                  <Button asChild>
                    <Link href="/sell">Create a listing</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              salesAsSeller.map((p) => (
                <OrderCard key={p.id} p={p} showCounterparty={true} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
