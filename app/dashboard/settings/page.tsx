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
import { Loader2, Save, LogOut, Camera, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { validateDisplayName } from '@/lib/display-name-validation'
import { useLocale } from '@/components/locale-provider'

interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  location: string | null
  city: string | null
  bio: string | null
}

export default function SettingsPage() {
  const { t } = useLocale()
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

    const nameCheck = validateDisplayName(profile.display_name, profile.email)
    if (!nameCheck.valid) {
      toast.error(nameCheck.error)
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name,
        location: profile.location,
        city: profile.city,
        bio: profile.bio,
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

  const s = t('settings')
  const p = s.profile
  const a = s.account

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{s.title}</h1>
        <p className="text-muted-foreground">{s.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{p.title}</CardTitle>
          <CardDescription>{p.description}</CardDescription>
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
              <p className="text-sm font-medium text-foreground">{p.photo}</p>
              <p className="text-xs text-muted-foreground">{p.photoHint}</p>
              <label
                htmlFor="avatar-upload"
                className="inline-flex cursor-pointer items-center text-xs font-medium text-primary hover:underline"
              >
                {uploadingAvatar ? p.uploading : p.changePhoto}
              </label>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="email">{p.email}</Label>
            <Input
              id="email"
              type="email"
              value={profile.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">{p.emailHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">
              {p.displayName} <span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Input
              id="display_name"
              value={profile.display_name || ''}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              placeholder={p.displayNamePlaceholder}
              required
              aria-required="true"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">{p.location}</Label>
              <Input
                id="location"
                value={profile.location || ''}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder={p.locationPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{p.city}</Label>
              <Input
                id="city"
                value={profile.city || ''}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder={p.cityPlaceholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{p.bio}</Label>
            <Textarea
              id="bio"
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder={p.bioPlaceholder}
              rows={4}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {p.saving}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {p.save}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{a.title}</CardTitle>
          <CardDescription>{a.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{a.signOut}</p>
              <p className="text-sm text-muted-foreground">{a.signOutDescription}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {a.signOut}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
