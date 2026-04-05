'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Bell, Globe, Loader2, MapPin, Receipt, Shield } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BuyerOrdersTab } from '@/components/buyer-purchases-tab'
import { toast } from 'sonner'
import { useLocale } from '@/components/locale-provider'
import type { Locale } from '@/lib/translations'

interface UserPreferences {
  email_notifications: boolean
  message_notifications: boolean
  listing_updates: boolean
  show_location: boolean
  show_online_status: boolean
  default_radius: string
}

const DEFAULT_PREFS: UserPreferences = {
  email_notifications: true,
  message_notifications: true,
  listing_updates: true,
  show_location: true,
  show_online_status: false,
  default_radius: '50',
}

const PREFS_KEY = 'reswell_user_preferences'

function loadPrefs(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(prefs: UserPreferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export default function PreferencesPage() {
  const { locale, setLocale, supportedLocales } = useLocale()
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      setPrefs(loadPrefs())
      setLoading(false)
    }
    init()
  }, [supabase])

  function updatePref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    savePrefs(updated)
    toast.success('Setting updated')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your notifications, privacy, preferences, and orders</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Orders
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-6">
          <BuyerOrdersTab />
        </TabsContent>
        <TabsContent value="general" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Choose what you want to be notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates about your account via email</p>
            </div>
            <Switch
              checked={prefs.email_notifications}
              onCheckedChange={(v) => updatePref('email_notifications', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Message alerts</p>
              <p className="text-sm text-muted-foreground">Get notified when someone messages you about a listing</p>
            </div>
            <Switch
              checked={prefs.message_notifications}
              onCheckedChange={(v) => updatePref('message_notifications', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Listing updates</p>
              <p className="text-sm text-muted-foreground">Get notified about price drops on your saved listings</p>
            </div>
            <Switch
              checked={prefs.listing_updates}
              onCheckedChange={(v) => updatePref('listing_updates', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy
          </CardTitle>
          <CardDescription>Control what others can see about you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Show location on listings</p>
              <p className="text-sm text-muted-foreground">Display your city and state on your listings</p>
            </div>
            <Switch
              checked={prefs.show_location}
              onCheckedChange={(v) => updatePref('show_location', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Show online status</p>
              <p className="text-sm text-muted-foreground">Let buyers see when you were last active</p>
            </div>
            <Switch
              checked={prefs.show_online_status}
              onCheckedChange={(v) => updatePref('show_online_status', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Search Preferences
          </CardTitle>
          <CardDescription>Customize your default search behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Default search radius</p>
              <p className="text-sm text-muted-foreground">Set the default distance for nearby listings</p>
            </div>
            <Select
              value={prefs.default_radius}
              onValueChange={(v) => updatePref('default_radius', v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 miles</SelectItem>
                <SelectItem value="25">25 miles</SelectItem>
                <SelectItem value="50">50 miles</SelectItem>
                <SelectItem value="100">100 miles</SelectItem>
                <SelectItem value="250">250 miles</SelectItem>
                <SelectItem value="any">Any distance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language
          </CardTitle>
          <CardDescription>Choose your preferred language</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Display language</p>
              <p className="text-sm text-muted-foreground">Select the language used across the site</p>
            </div>
            <Select
              value={locale}
              onValueChange={(value) => {
                setLocale(value as Locale)
                toast.success(value === 'es' ? 'Idioma actualizado' : 'Language updated')
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLocales.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
