'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Plus, Search, UserCog, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { setImpersonation } from '@/lib/impersonation'

interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

export default function AdminAddListingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url')
        .order('display_name')
      setUsers((data as Profile[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    )
  }, [users, search])

  async function startForUser(user: Profile) {
    setStarting(user.id)
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email,
      }),
    })
    if (res.ok) {
      setImpersonation({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email,
      })
      toast.success(`Creating listing as ${user.display_name || 'user'}`)
      router.push('/sell')
    } else {
      toast.error('Failed to start — check admin permissions')
      setStarting(null)
    }
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
          <h1 className="text-2xl font-bold text-foreground">Create listing for user</h1>
          <p className="text-muted-foreground">
            Pick a user below — you'll be taken to the full listing form to create it on their behalf
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Select the listing owner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading users...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No users match your search</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border max-h-[28rem] overflow-y-auto">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={starting !== null}
                  onClick={() => void startForUser(user)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {user.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="text-sm font-medium">
                      {(user.display_name || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.display_name || 'Unnamed user'}
                    </p>
                    {user.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    {starting === user.id ? (
                      <span className="text-xs text-primary animate-pulse">Opening form...</span>
                    ) : (
                      <>
                        <span className="text-xs hidden sm:inline">Create listing</span>
                        <ExternalLink className="h-4 w-4" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <UserCog className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Selecting a user starts <strong>"Act as User"</strong> mode and opens the full listing form.
              You'll see the amber banner at the top while acting as them.
              When you're done, click <strong>"Stop Acting as User"</strong> in the header to return to your admin account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
