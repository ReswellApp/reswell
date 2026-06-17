"use client"

import { useCallback, useEffect, useState } from "react"
import {
  createProfileAddress,
  deleteProfileAddress,
  getProfileAddresses,
  updateProfileAddress,
} from "@/app/actions/addresses"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ShippingAddressFormInput } from "@/lib/address-input"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

export type ProfileAddressesCopy = {
  tab: string
  title: string
  description: string
  add: string
  empty: string
  defaultBadge: string
  setDefault: string
  edit: string
  delete: string
  deleteTitle: string
  deleteDescription: string
  save: string
  cancel: string
  line1: string
  line2: string
  city: string
  state: string
  postal: string
  country: string
  label: string
  addTitle: string
  editTitle: string
  shippingOnlyHint: string
}

const emptyForm: ShippingAddressFormInput = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  label: "",
  is_default: false,
}

function formatShippingLines(a: ProfileAddressRow): string[] {
  return [
    [a.line1, a.line2].filter(Boolean).join(", "),
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
    a.country !== "US" ? a.country : null,
  ].filter(Boolean) as string[]
}

export function ProfileAddressesManager({
  copy,
  initialAddresses,
  fetchError,
}: {
  copy: ProfileAddressesCopy
  initialAddresses?: ProfileAddressRow[]
  fetchError?: string
}) {
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>(initialAddresses ?? [])
  const [loading, setLoading] = useState(initialAddresses === undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ShippingAddressFormInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { addresses: rows, error } = await getProfileAddresses()
    if (error) {
      toast.error(error)
    } else {
      setAddresses(rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (initialAddresses !== undefined) {
      setAddresses(initialAddresses)
      setLoading(false)
      return
    }
    void load()
  }, [load, initialAddresses])

  function openAdd() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      is_default: addresses.length === 0,
    })
    setDialogOpen(true)
  }

  function openEdit(row: ProfileAddressRow) {
    setEditingId(row.id)
    setForm({
      line1: row.line1,
      line2: row.line2 ?? "",
      city: row.city,
      state: row.state ?? "",
      postal_code: row.postal_code,
      country: row.country,
      label: row.label ?? "",
      is_default: row.is_default,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: ShippingAddressFormInput = {
        line1: form.line1.trim(),
        line2: form.line2?.trim() || null,
        city: form.city.trim(),
        state: form.state?.trim() || null,
        postal_code: form.postal_code.trim(),
        country: form.country.trim() || "US",
        label: form.label?.trim() || null,
        is_default: form.is_default,
      }

      if (!payload.line1 || !payload.city || !payload.postal_code) {
        toast.error("Street, city, and ZIP code are required.")
        setSaving(false)
        return
      }

      if (editingId) {
        const { error } = await updateProfileAddress(editingId, payload)
        if (error) {
          toast.error(error ?? "Could not update address")
          return
        }
        await load()
      } else {
        const { error } = await createProfileAddress(payload)
        if (error) {
          toast.error(error ?? "Could not save address")
          return
        }
        await load()
      }
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault(id: string) {
    const { error } = await updateProfileAddress(id, { is_default: true })
    if (error) {
      toast.error(error ?? "Could not update default")
      return
    }
    await load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { ok, error } = await deleteProfileAddress(deleteId)
      if (!ok) {
        toast.error(error ?? "Could not delete")
        return
      }
      setAddresses((prev) => prev.filter((a) => a.id !== deleteId))
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      {fetchError ? (
        <p className="mb-4 text-sm text-destructive">Could not load addresses. Please refresh the page.</p>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {copy.add}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => {
                const lines = formatShippingLines(a)
                return (
                  <li
                    key={a.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {a.label?.trim() || "Shipping address"}
                          </span>
                          {a.is_default ? (
                            <Badge variant="secondary" className="text-xs">
                              {copy.defaultBadge}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="space-y-0.5 text-sm text-muted-foreground">
                          {lines.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!a.is_default ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleSetDefault(a.id)}>
                          {copy.setDefault}
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {copy.edit}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {copy.delete}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.editTitle : copy.addTitle}</DialogTitle>
            <DialogDescription>{copy.shippingOnlyHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-label">{copy.label}</Label>
              <Input
                id="addr-label"
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Home, Work…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-l1">{copy.line1}</Label>
              <Input
                id="addr-l1"
                autoComplete="address-line1"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-l2">{copy.line2}</Label>
              <Input
                id="addr-l2"
                autoComplete="address-line2"
                value={form.line2 ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">{copy.city}</Label>
              <Input
                id="addr-city"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-st">{copy.state}</Label>
              <Input
                id="addr-st"
                autoComplete="address-level1"
                value={form.state ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-zip">{copy.postal}</Label>
              <Input
                id="addr-zip"
                autoComplete="postal-code"
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-ctry">{copy.country}</Label>
              <Input
                id="addr-ctry"
                autoComplete="country-name"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3 sm:col-span-2">
              <span className="text-sm font-medium">{copy.defaultBadge}</span>
              <Switch
                checked={form.is_default ?? false}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_default: c }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
