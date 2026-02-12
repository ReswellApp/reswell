'use client'

import React from "react"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Store, ShoppingBag, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Profile {
  id: string
  is_shop: boolean
  shop_name: string | null
  shop_description: string | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  shop_verified: boolean
  shopify_domain: string | null
}

export default function DashboardProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('id, is_shop, shop_name, shop_description, shop_website, shop_phone, shop_address, shop_verified, shopify_domain')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setProfile(data as Profile)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [supabase])

  async function handleSave() {
    if (!profile) return

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        is_shop: profile.is_shop,
        shop_name: profile.shop_name,
        shop_description: profile.shop_description,
        shop_website: profile.shop_website,
        shop_phone: profile.shop_phone,
        shop_address: profile.shop_address,
        shopify_domain: profile.shopify_domain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (!error) {
      toast.success('Seller profile updated successfully')
    } else {
      toast.error('Failed to update seller profile')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Seller Profile</h1>
        <p className="text-muted-foreground">Manage your store info and appear in the Sellers directory</p>
      </div>

      <Card className={profile.is_shop ? 'border-primary/30' : ''}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Seller Profile</CardTitle>
              <CardDescription>
                Register as a retail seller to list store inventory
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-foreground">Enable Seller Profile</p>
              <p className="text-sm text-muted-foreground">
                Activate to appear in the Sellers directory and display your store info
              </p>
            </div>
            <Switch
              checked={profile.is_shop || false}
              onCheckedChange={(checked) =>
                setProfile({ ...profile, is_shop: checked })
              }
            />
          </div>

          {profile.is_shop && (
            <div className="space-y-4">
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="shop_name">Seller Name</Label>
                <Input
                  id="shop_name"
                  value={profile.shop_name || ''}
                  onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
                  placeholder="e.g., Pacific Surf Supply"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shop_description">Seller Description</Label>
                <Textarea
                  id="shop_description"
                  value={profile.shop_description || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, shop_description: e.target.value })
                  }
                  placeholder="Tell customers about what you sell, what you specialize in, brands you carry..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shop_address">Seller Address</Label>
                <Input
                  id="shop_address"
                  value={profile.shop_address || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, shop_address: e.target.value })
                  }
                  placeholder="e.g., 123 Coast Hwy, Encinitas, CA 92024"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shop_website">Website</Label>
                  <Input
                    id="shop_website"
                    type="url"
                    value={profile.shop_website || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, shop_website: e.target.value })
                    }
                    placeholder="https://yourshop.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop_phone">Phone</Label>
                  <Input
                    id="shop_phone"
                    type="tel"
                    value={profile.shop_phone || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, shop_phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              {profile.shop_verified && (
                <div className="rounded-lg bg-primary/5 p-3 text-sm text-primary flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Your seller profile is verified and will appear with a verified badge.
                </div>
              )}

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#96bf48]" />
                  <h4 className="font-medium text-foreground">Shopify Integration</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Shopify store to automatically list your products in the New Gear section.
                  Your products will appear alongside ReSwell Surf listings and link back to your Shopify checkout.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="shopify_domain">Shopify Store Domain</Label>
                  <Input
                    id="shopify_domain"
                    value={profile.shopify_domain || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, shopify_domain: e.target.value })
                    }
                    placeholder="your-store.myshopify.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Shopify store domain (e.g., my-surf-shop.myshopify.com). Your store must have the Storefront API enabled with public access.
                  </p>
                </div>
                {profile.shopify_domain && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#96bf48]/30 bg-[#96bf48]/5 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[#96bf48] flex-shrink-0" />
                    <span className="text-foreground">
                      Shopify store connected: <span className="font-medium">{profile.shopify_domain}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {profile.is_shop ? 'Save Seller Profile' : 'Save Changes'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
