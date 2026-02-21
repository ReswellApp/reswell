'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, MoreVertical, Users, Shield, ShieldOff, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  city: string | null
  is_admin: boolean
  is_employee: boolean
  created_at: string
  listings_count: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Get listings count for each user
      const usersWithCounts = await Promise.all(
        data.map(async (user) => {
          const { count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
          return { ...user, listings_count: count || 0 }
        })
      )
      setUsers(usersWithCounts as User[])
    }
    setLoading(false)
  }

  async function toggleAdmin(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_admin: false } : { is_admin: true, is_employee: false }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentStatus, is_employee: currentStatus ? u.is_employee : false } : u))
      toast.success(currentStatus ? 'Admin access removed' : 'Admin access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleEmployee(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_employee: false } : { is_employee: true, is_admin: false }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_employee: !currentStatus, is_admin: currentStatus ? u.is_admin : false } : u))
      toast.success(currentStatus ? 'Employee access removed' : 'Employee access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Listings</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <div className="relative w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url || "/placeholder.svg"}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-foreground font-semibold text-sm">
                              {user.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-foreground hover:text-primary">
                          {user.display_name || 'Unknown'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.city || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.listings_count}</TableCell>
                    <TableCell>
                      {user.is_admin ? (
                        <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                      ) : user.is_employee ? (
                        <Badge variant="secondary">Employee</Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleAdmin(user.id, user.is_admin)}>
                            {user.is_admin ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" /> Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" /> Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEmployee(user.id, user.is_employee)}>
                            {user.is_employee ? (
                              <>
                                <UserCog className="h-4 w-4 mr-2" /> Remove Employee
                              </>
                            ) : (
                              <>
                                <UserCog className="h-4 w-4 mr-2" /> Make Employee
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
