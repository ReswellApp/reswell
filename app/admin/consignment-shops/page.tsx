import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Building2 } from "lucide-react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  listAdminConsignmentStores,
  listConsignmentShopOperatorsForAdmin,
} from "@/lib/services/adminConsignmentStoresList"
import { storeNavHref } from "@/lib/store-nav-links"
import { privatePageMetadata } from "@/lib/site-metadata"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminConsignmentShopsPanel } from "@/components/features/admin/admin-consignment-shops-panel"

export const metadata = privatePageMetadata({
  title: "Consignment shops — Admin",
  description: "All consignment stores on Reswell: owners, status, and operator access.",
  path: "/admin/consignment-shops",
})

export default async function AdminConsignmentShopsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/consignment-shops")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect("/admin")
  }

  const [storesResult, operatorsResult] = await Promise.all([
    listAdminConsignmentStores(),
    listConsignmentShopOperatorsForAdmin(),
  ])

  const stores = storesResult.ok ? storesResult.stores : []
  const operators = operatorsResult.ok ? operatorsResult.operators : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Consignment shops</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Two steps for each operator: grant the consignment-shop role in Users, then create a
            store or transfer an existing one. Granting the role alone does not move or create
            stores.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">Manage users</Link>
        </Button>
      </div>

      {!storesResult.ok || !operatorsResult.ok ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {!storesResult.ok ? storesResult.message : operatorsResult.message}
          </CardContent>
        </Card>
      ) : (
        <>
          <AdminConsignmentShopsPanel stores={stores} operators={operators} />

          {stores.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">No consignment stores yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {stores.length} store{stores.length === 1 ? "" : "s"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="hidden md:table-cell">Commission</TableHead>
                      <TableHead className="hidden lg:table-cell">Staff</TableHead>
                      <TableHead className="hidden lg:table-cell">Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium">{store.name}</p>
                            <p className="text-xs text-muted-foreground">/{store.slug}</p>
                            <div className="mt-1">
                              <Badge variant={store.status === "active" ? "default" : "secondary"}>
                                {store.status}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate text-sm">{store.ownerDisplayName ?? "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {store.ownerEmail ?? store.ownerProfileId}
                            </p>
                            {!store.ownerIsConsignmentShop ? (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Role not granted
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden tabular-nums md:table-cell">
                          {(store.defaultCommissionBps / 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{store.staffCount}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {format(new Date(store.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/users/${store.ownerProfileId}`}>
                                Owner profile
                              </Link>
                            </Button>
                            {store.ownerIsConsignmentShop ? (
                              <Button asChild variant="ghost" size="sm">
                                <Link
                                  href={storeNavHref(store.slug, "/dashboard")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Shop hub
                                  <ExternalLink className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
