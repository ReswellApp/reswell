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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  postal: string
  country: string
  label: string
  addTitle: string
  editTitle: string
}

const emptyForm = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  label: "",
  is_default: false,
}

export function ProfileAddressesManager({ copy }: { copy: ProfileAddressesCopy }) {
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
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
    load()
  }, [load])

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
      full_name: row.full_name,
      phone: row.phone ?? "",
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
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim(),
        country: form.country.trim() || "US",
        label: form.label.trim() || null,
        is_default: form.is_default,
      }
      if (!payload.full_name || !payload.line1 || !payload.city || !payload.postal_code) {
        toast.error("Name, street, city, and postal code are required.")
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
        toast.success("Address updated")
      } else {
        const { error } = await createProfileAddress(payload)
        if (error) {
          toast.error(error ?? "Could not save address")
          return
        }
        await load()
        toast.success("Address saved")
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
    toast.success("Default address updated")
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
      toast.success("Address removed")
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  function formatBlock(a: ProfileAddressRow) {
    const lines = [
      a.full_name,
      [a.line1, a.line2].filter(Boolean).join(", "),
      [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean)
    return lines.join("\n")
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
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            {copy.add}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
              {copy.empty}
            </p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.label ? (
                        <span className="font-medium text-foreground">{a.label}</span>
                      ) : null}
                      {a.is_default ? (
                        <Badge variant="secondary" className="text-xs">
                          {copy.defaultBadge}
                        </Badge>
                      ) : null}
                    </div>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                      {formatBlock(a)}
                    </pre>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {!a.is_default && (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleSetDefault(a.id)}>
                        {copy.setDefault}
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {copy.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {copy.delete}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.editTitle : copy.addTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-label">{copy.label}</Label>
              <Input
                id="addr-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Home, Work…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-fn">{copy.fullName}</Label>
              <Input
                id="addr-fn"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-ph">{copy.phone}</Label>
              <Input
                id="addr-ph"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-l1">{copy.line1}</Label>
              <Input
                id="addr-l1"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-l2">{copy.line2}</Label>
              <Input
                id="addr-l2"
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-city">{copy.city}</Label>
              <Input
                id="addr-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-st">{copy.state}</Label>
              <Input
                id="addr-st"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-zip">{copy.postal}</Label>
              <Input
                id="addr-zip"
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-ctry">{copy.country}</Label>
              <Input
                id="addr-ctry"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2 rounded-lg border p-3">
              <span className="text-sm font-medium">{copy.defaultBadge}</span>
              <Switch
                checked={form.is_default}
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
                confirmDelete()
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
