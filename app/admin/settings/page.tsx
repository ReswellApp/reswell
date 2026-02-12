'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Mail, Info } from 'lucide-react'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground">Super-admin configuration and marketplace controls</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Super Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Designated admin email:</span>
            <Badge variant="secondary" className="font-mono">
              haydensbsb@gmail.com
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Only this account can access the admin area. Ensure your profile has <code className="rounded bg-muted px-1">is_admin = true</code> in the database (run script <code className="rounded bg-muted px-1">007_admin_super_account_and_policies.sql</code> in Supabase SQL Editor if needed).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            What you can do
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Overview</strong> — Site stats, listings by section, recent activity</li>
            <li><strong className="text-foreground">Listings</strong> — Search, filter, view, remove, restore, or permanently delete any listing; add listings on behalf of users</li>
            <li><strong className="text-foreground">Users</strong> — View all accounts, grant or revoke admin (other accounts still cannot access admin unless you add them later)</li>
            <li><strong className="text-foreground">Reports</strong> — Review and resolve user reports (listing or user reports)</li>
            <li><strong className="text-foreground">Settings</strong> — This page</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
