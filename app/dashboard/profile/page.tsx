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
import { Loader2, Save, Store } from 'lucide-react'
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
        .select('id, is_shop, shop_name, shop_description, shop_website, shop_phone, shop_address, shop_verified')
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
