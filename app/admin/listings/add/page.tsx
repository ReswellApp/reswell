'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

const SECTION_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  used: [
    { value: '2744c29e-d6d4-43d9-a3ee-5bc11a0027df', label: 'Wetsuits' },
    { value: 'f8327e72-d54c-4333-b383-58a8cef225a6', label: 'Fins' },
    { value: 'b2a6282c-4c23-42dc-83f4-492eaa4f993a', label: 'Leashes' },
    { value: 'a5000005-0000-4000-8000-000000000005', label: 'Traction Pads' },
    { value: '3779de38-dcf8-430f-a42c-9a17a2e048c4', label: 'Board Bags' },
    { value: 'a6000006-0000-4000-8000-000000000006', label: 'Backpacks' },
    { value: 'a2000002-0000-4000-8000-000000000002', label: 'Apparel & Lifestyle' },
    { value: 'a3000003-0000-4000-8000-000000000003', label: 'Collectibles & Vintage' },
  ],
  new: [
    { value: 'a5000005-0000-4000-8000-000000000005', label: 'Traction Pads' },
    { value: 'b2a6282c-4c23-42dc-83f4-492eaa4f993a', label: 'Leashes' },
    { value: 'f8327e72-d54c-4333-b383-58a8cef225a6', label: 'Fins' },
    { value: '2744c29e-d6d4-43d9-a3ee-5bc11a0027df', label: 'Wetsuits' },
    { value: '3779de38-dcf8-430f-a42c-9a17a2e048c4', label: 'Board Bags' },
  ],
  surfboards: [
    { value: '7e434a96-f3f7-4a73-b733-704a769195e6', label: 'Shortboard' },
    { value: 'f3ccddc0-f0f3-45d3-ad43-51bcf9935b45', label: 'Fish' },
    { value: '93b8eeaf-366b-4823-8bb9-98d42c5fefba', label: 'Mid-Length' },
    { value: '47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3', label: 'Longboard' },
    { value: '7cc95cb5-2391-4e53-a48e-42977bf9504b', label: 'Soft Top' },
  ],
}

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
]

interface Profile {
  id: string
  display_name: string | null
  email: string | null
}

export default function AdminAddListingPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    user_id: '',
    title: '',
    description: '',
    price: '',
    condition: '',
    section: 'used',
    category_id: '',
    shipping_available: false,
    local_pickup: true,
    shipping_price: '',
    city: '',
    state: '',
    image_urls: '',
    inventory_quantity: '',
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .order('display_name')
      setUsers((data as Profile[]) || [])
      setLoadingUsers(false)
    }
    load()
  }, [])

  const categories = SECTION_CATEGORIES[form.section] || SECTION_CATEGORIES.used

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_id || !form.title || !form.description || !form.price || !form.category_id) {
      toast.error('Fill in required fields: user, title, description, price, category')
      return
    }
    setSaving(true)
    try {
      const images = form.image_urls
        ? form.image_urls.split(/\s+/).map((u) => u.trim()).filter(Boolean)
        : []
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: form.user_id,
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          condition: form.condition || null,
          section: form.section,
          category_id: form.category_id,
          shipping_available: form.shipping_available,
          local_pickup: form.local_pickup,
          shipping_price: form.shipping_price ? parseFloat(form.shipping_price) : null,
          city: form.city || null,
          state: form.state || null,
          images,
          inventory_quantity: form.section === 'new' && form.inventory_quantity ? parseInt(form.inventory_quantity, 10) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create listing')
        setSaving(false)
        return
      }
      toast.success('Listing created')
      setForm({
        user_id: '',
        title: '',
        description: '',
        price: '',
        condition: '',
        section: 'used',
        category_id: '',
        shipping_available: false,
        local_pickup: true,
        shipping_price: '',
        city: '',
        state: '',
        image_urls: '',
        inventory_quantity: '',
      })
      if (data.listing_id) {
        window.location.href = `/admin/listings?created=${data.listing_id}`
      }
    } catch {
      toast.error('Failed to create listing')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/listings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add listing (for user)</h1>
          <p className="text-muted-foreground">Create a listing on behalf of a marketplace user</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            New listing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Owner (user) *</Label>
              <Select
                value={form.user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select user'} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name || u.email || u.id.slice(0, 8)}
                      {u.email && ` (${u.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Section *</Label>
                <Select
                  value={form.section}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, section: v, category_id: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="used">Used Gear</SelectItem>
                    <SelectItem value="new">New Items</SelectItem>
                    <SelectItem value="surfboards">Surfboards</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Listing title"
                required
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Full description"
                rows={4}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              {form.section !== 'surfboards' && (
                <div>
                  <Label>Condition</Label>
                  <Select
                    value={form.condition}
                    onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {form.section === 'new' && (
              <div>
                <Label>Inventory quantity (for New items)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.inventory_quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, inventory_quantity: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <Label>Image URLs (one per line or space-separated)</Label>
              <Textarea
                value={form.image_urls}
                onChange={(e) => setForm((f) => ({ ...f, image_urls: e.target.value }))}
                placeholder="https://..."
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create listing
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/listings">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
