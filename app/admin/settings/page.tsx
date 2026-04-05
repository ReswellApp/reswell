'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Info, LayoutDashboard, Package, Users, Settings, ArrowRight, Shield, UserCog, Loader2, Search, RefreshCw, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const SUPER_ADMIN_EMAIL = 'haydensbsb@gmail.com'

const capabilities = [
  { title: 'Overview', description: 'Site stats, listings by section, recent activity', href: '/admin', icon: LayoutDashboard },
  { title: 'Live', description: 'Signed-in users active on the site in the last few minutes', href: '/admin/live', icon: Activity },
  { title: 'Listings', description: 'Search, filter, view, remove, restore, or permanently delete any listing; add listings on behalf of users', href: '/admin/listings', icon: Package },
  { title: 'Users', description: 'View all accounts, grant or revoke admin or employee access', href: '/admin/users', icon: Users },
  { title: 'Settings', description: 'This page', href: '/admin/settings', icon: Settings },
] as const

interface ProfileRole {
  id: string
  email: string | null
  display_name: string | null
  is_admin: boolean
  is_employee: boolean
}

export default function AdminSettingsPage() {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [grantingAdmin, setGrantingAdmin] = useState(false)
  const [grantingEmployee, setGrantingEmployee] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [admins, setAdmins] = useState<ProfileRole[]>([])
  const [employees, setEmployees] = useState<ProfileRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentEmail(user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, display_name, is_admin, is_employee')
        .or('is_admin.eq.true,is_employee.eq.true')
      if (data) {
        setAdmins(data.filter((p) => p.is_admin))
        setEmployees(data.filter((p) => p.is_employee && !p.is_admin))
      }
      setLoadingRoles(false)
    }
    load()
  }, [])

  const isSuperAdmin = currentEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()

  async function grantRole(email: string, role: 'admin' | 'employee') {
    const setGranting = role === 'admin' ? setGrantingAdmin : setGrantingEmployee
    setGranting(true)
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, grant: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to grant role')
        return
      }
      toast.success(role === 'admin' ? 'Admin access granted' : 'Employee access granted')
      if (role === 'admin') setAdminEmail('')
      else setEmployeeEmail('')
      const { data: list } = await supabase
        .from('profiles')
        .select('id, email, display_name, is_admin, is_employee')
        .or('is_admin.eq.true,is_employee.eq.true')
      if (list) {
        setAdmins(list.filter((p) => p.is_admin))
        setEmployees(list.filter((p) => p.is_employee && !p.is_admin))
      }
    } finally {
      setGranting(false)
    }
  }

  async function revokeRole(userId: string, role: 'admin' | 'employee') {
    const profile = [...admins, ...employees].find((p) => p.id === userId)
    const email = profile?.email
    if (!email) {
      toast.error('Cannot revoke: no email')
      return
    }
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, grant: false }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to revoke')
        return
      }
      toast.success(role === 'admin' ? 'Admin access removed' : 'Employee access removed')
      const { data: list } = await supabase
        .from('profiles')
        .select('id, email, display_name, is_admin, is_employee')
        .or('is_admin.eq.true,is_employee.eq.true')
      if (list) {
        setAdmins(list.filter((p) => p.is_admin))
        setEmployees(list.filter((p) => p.is_employee && !p.is_admin))
      }
    } catch {
      toast.error('Failed to revoke')
    }
  }

  async function reindexSearch() {
    setReindexing(true)
    try {
      const res = await fetch('/api/search/reindex', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `Reindex failed (${res.status})`
        toast.error(msg)
        return
      }
      toast.success(`Reindex complete: ${data.indexed} listings indexed${data.errors ? `, ${data.errors} errors` : ''}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reindex failed'
      toast.error(msg)
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground mt-1">
          Super-admin configuration and marketplace controls
        </p>
      </div>

      {isSuperAdmin && (
        <>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Add admin
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Full access: Overview, Listings, Users, Settings. Can grant or revoke admin and employee.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Label htmlFor="admin-email" className="sr-only">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="user@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  onClick={() => adminEmail.trim() && grantRole(adminEmail.trim(), 'admin')}
                  disabled={grantingAdmin || !adminEmail.trim()}
                >
                  {grantingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant admin'}
                </Button>
              </div>
              {!loadingRoles && admins.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Current admins</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {admins.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{p.display_name || `User ${p.id.slice(0, 8)}`}{p.email && ` (${p.email})`}</span>
                        {p.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeRole(p.id, 'admin')}>
                            Revoke
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="h-5 w-5 text-primary" />
                Add employee
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Limited access: Overview and Listings only. Cannot manage users or settings.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Label htmlFor="employee-email" className="sr-only">Email</Label>
                <Input
                  id="employee-email"
                  type="email"
                  placeholder="user@example.com"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="secondary"
                  onClick={() => employeeEmail.trim() && grantRole(employeeEmail.trim(), 'employee')}
                  disabled={grantingEmployee || !employeeEmail.trim()}
                >
                  {grantingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant employee'}
                </Button>
              </div>
              {!loadingRoles && employees.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Current employees</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {employees.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{p.display_name || `User ${p.id.slice(0, 8)}`}{p.email && ` (${p.email})`}</span>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeRole(p.id, 'employee')}>
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Search index (Elasticsearch)
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Rebuild the search index from your listings. Use after adding Elasticsearch, or if search results seem stale.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={reindexSearch}
            disabled={reindexing}
          >
            {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {reindexing ? 'Reindexing…' : 'Reindex search'}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            What you can do
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {capabilities.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 rounded-lg border border-transparent p-3 transition-colors hover:bg-muted/50 hover:border-border"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
