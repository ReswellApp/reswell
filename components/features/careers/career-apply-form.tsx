"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { CareerApplicationReceived } from "@/components/features/careers/career-application-received"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type CareerApplyFormProps = {
  roleSlug?: string | null
  roleTitle?: string
  surfingLabel: string
  favoriteBoardLabel: string
  note?: string
  submitLabel?: string
  variant?: "card" | "page"
  onSuccess?: (applicantName: string) => void
}

export function CareerApplyForm({
  roleSlug = null,
  roleTitle = "General application",
  surfingLabel,
  favoriteBoardLabel,
  note,
  submitLabel = "Submit application",
  variant = "card",
  onSuccess,
}: CareerApplyFormProps) {
  const fieldId = useId()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [surfingNote, setSurfingNote] = useState("")
  const [favoriteBoard, setFavoriteBoard] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget

    const body = new FormData()
    if (roleSlug) body.set("roleSlug", roleSlug)
    body.set("name", name)
    body.set("email", email)
    body.set("phone", phone)
    body.set("surfingNote", surfingNote)
    body.set("favoriteBoard", favoriteBoard)
    const honeypot = form.elements.namedItem("company")
    if (honeypot instanceof HTMLInputElement) {
      body.set("company", honeypot.value)
    }

    setLoading(true)
    try {
      const response = await fetch("/api/careers/apply", {
        method: "POST",
        body,
      })
      const data: unknown = await response.json().catch(() => null)
      const error =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : null
      if (!response.ok || error) {
        toast.error(error ?? "Could not submit your application")
        return
      }
      setSubmitted(true)
      onSuccess?.(name.trim())
    } catch {
      toast.error("Could not submit your application")
    } finally {
      setLoading(false)
    }
  }

  if (submitted && !onSuccess) {
    return <CareerApplicationReceived applicantName={name} roleTitle={roleTitle} />
  }

  if (submitted) {
    return null
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("relative", variant === "page" ? "space-y-5" : "space-y-3.5")}
    >
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-name`}>Name</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={variant === "page" ? "h-11 text-base" : undefined}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-email`}>Email</Label>
        <Input
          id={`${fieldId}-email`}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={variant === "page" ? "h-11 text-base" : undefined}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-phone`}>
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${fieldId}-phone`}
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className={variant === "page" ? "h-11 text-base" : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-surfing`}>{surfingLabel}</Label>
        <Textarea
          id={`${fieldId}-surfing`}
          name="surfingNote"
          value={surfingNote}
          onChange={(e) => setSurfingNote(e.target.value)}
          rows={variant === "page" ? 5 : 4}
          className={cn("resize-y text-base", variant === "page" ? "min-h-[120px]" : "min-h-[96px]")}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-board`}>{favoriteBoardLabel}</Label>
        <Textarea
          id={`${fieldId}-board`}
          name="favoriteBoard"
          value={favoriteBoard}
          onChange={(e) => setFavoriteBoard(e.target.value)}
          rows={variant === "page" ? 4 : 3}
          className={cn("resize-y text-base", variant === "page" ? "min-h-[100px]" : "min-h-[80px]")}
          required
        />
      </div>
      {note ? <p className="text-xs leading-relaxed text-muted-foreground">{note}</p> : null}
      <Button type="submit" className="min-h-11 w-full" disabled={loading}>
        {loading ? "Submitting…" : submitLabel}
      </Button>
    </form>
  )
}
