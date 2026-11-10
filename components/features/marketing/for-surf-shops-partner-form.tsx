"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { submitSurfShopPartnerApplication } from "@/lib/actions/surfShopPartner"
import { FOR_SURF_SHOPS_OFFER_MONTHS } from "@/lib/for-surf-shops"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForSurfShopsPartnerForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [shopName, setShopName] = useState("")
  const [city, setCity] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await submitSurfShopPartnerApplication({
        email,
        shopName,
        city,
      })
      if ("error" in data) {
        toast.error(data.error ?? "Failed to send")
        return
      }
      setSubmitted(true)
    } catch {
      toast.error("Failed to send")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-8 text-center sm:px-8 sm:py-10">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E8EEF8] text-[#001A4A]">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-4 text-lg font-semibold tracking-tight text-[#001A4A]">You&apos;re in</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#5c6b89]">
          We&apos;ll confirm your shop and turn on {FOR_SURF_SHOPS_OFFER_MONTHS} months of no
          selling fees. Watch your inbox.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.75rem] bg-white px-6 py-7 sm:px-8 sm:py-8"
      noValidate
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="shop-partner-shop" className="text-[#001A4A]">
            Shop name
          </Label>
          <Input
            id="shop-partner-shop"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Your shop"
            className="h-11 rounded-xl border-border/80"
            required
            autoComplete="organization"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shop-partner-email" className="text-[#001A4A]">
            Email
          </Label>
          <Input
            id="shop-partner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourshop.com"
            className="h-11 rounded-xl border-border/80"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shop-partner-city" className="text-[#001A4A]">
            City
          </Label>
          <Input
            id="shop-partner-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Santa Barbara, CA"
            className="h-11 rounded-xl border-border/80"
            required
            autoComplete="address-level2"
          />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="mt-5 h-12 w-full rounded-full bg-[#001A4A] text-base font-semibold text-white hover:bg-[#001A4A]/90"
      >
        {loading ? "Sending…" : "Get 6 months free"}
      </Button>
    </form>
  )
}
