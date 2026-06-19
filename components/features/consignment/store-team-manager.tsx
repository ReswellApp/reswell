"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export type TeamMember = {
  profileId: string
  role: "owner" | "manager" | "clerk"
  name: string
  email: string | null
  isOwner: boolean
}

interface StoreTeamManagerProps {
  storeId: string
  members: TeamMember[]
}

export function StoreTeamManager({ storeId, members }: StoreTeamManagerProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"manager" | "clerk">("clerk")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch("/api/consignment/store/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, email: email.trim(), role }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Could not add staff member")
      setEmail("")
      setRole("clerk")
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff member")
    }
  }

  async function remove(profileId: string) {
    setError(null)
    try {
      const res = await fetch("/api/consignment/store/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, profileId }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Could not remove staff member")
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove staff member")
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <li key={m.profileId} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.name}</p>
              {m.email ? (
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {m.role}
              </span>
              {m.isOwner ? null : (
                <button
                  type="button"
                  onClick={() => remove(m.profileId)}
                  disabled={isPending}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="rounded-lg border p-4">
        <p className="text-sm font-medium">Add a staff member</p>
        <p className="mt-1 text-xs text-muted-foreground">
          They need a Reswell account with this email. Managers can approve intakes and re-price;
          clerks can run the register.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "manager" | "clerk")}
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="clerk">Clerk</option>
            <option value="manager">Manager</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50",
            )}
          >
            {isPending ? "…" : "Add"}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </form>
    </div>
  )
}
