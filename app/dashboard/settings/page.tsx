'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, LogOut, Store, ShoppingBag, ExternalLink, CheckCircle2, AlertCircle, Camera, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  location: string | null
  city: string | null
  bio: string | null
  is_shop: boolean
  shop_name: string | null
  shop_description: string | null
  shop_logo_url: string | null
  shop_banner_url: string | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  shop_verified: boolean
  shopify_domain: string | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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
        display_name: profile.display_name,
        location: profile.location,
        city: profile.city,
        bio: profile.bio,
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
      toast.success('Profile updated successfully')
    } else {
      toast.error('Failed to update profile')
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }

    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add cache-busting param so the browser loads the new image
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: avatarUrl })
      toast.success('Profile photo updated')
    } catch (err: any) {
      console.error('Avatar upload error:', err.message)
      toast.error('Failed to upload photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
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
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and profile</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your public profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Photo */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name} />
                <AvatarFallback className="text-lg bg-muted">
                  <User className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Profile Photo</p>
              <p className="text-xs text-muted-foreground">
                Click the avatar to upload. JPG, PNG, or WebP. Max 2MB.
              </p>
              <label
                htmlFor="avatar-upload"
                className="inline-flex cursor-pointer items-center text-xs font-medium text-primary hover:underline"
              >
                {uploadingAvatar ? 'Uploading...' : 'Change photo'}
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Your email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={profile.display_name || ''}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              placeholder="Your display name"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location || ''}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="e.g., California"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="e.g., San Diego"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell other surfers about yourself..."
              rows={4}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Shop Registration */}
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
          {/* Toggle */}
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

              {/* Shopify Integration */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#96bf48]" />
                  <h4 className="font-medium text-foreground">Shopify Integration</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Shopify store to automatically list your products in the New Gear section.
                  Your products will appear alongside reswell listings and link back to your Shopify checkout.
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

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Sign Out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
