"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Send } from "lucide-react"
import { toast } from "sonner"
import { submitSurfShopPartnerApplication } from "@/lib/actions/surfShopPartner"
import { FOR_SURF_SHOPS_OFFER_MONTHS } from "@/lib/for-surf-shops"
import { RESWELL_CONTACT_EMAIL, RESWELL_CONTACT_MAILTO } from "@/lib/constants/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ForSurfShopsPartnerForm() {
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [shopName, setShopName] = useState("")
  const [city, setCity] = useState("")
  const [website, setWebsite] = useState("")
  const [boardCount, setBoardCount] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await submitSurfShopPartnerApplication({
        name,
        email,
        shopName,
        city,
        website,
        boardCount,
        message,
      })
      if ("error" in data) {
        toast.error(data.error ?? "Failed to send application")
        return
      }
      setTicketId(data.ticketId ?? null)
      setSubmitted(true)
    } catch {
      toast.error("Failed to send application")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8EEF8] text-[#001A4A]">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-[#001A4A]">
              Application received
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">
              Thanks — we&apos;ll confirm your shop and turn on {FOR_SURF_SHOPS_OFFER_MONTHS} months
              of no selling fees. Expect a reply within 1–2 business days
              {ticketId ? " at this email" : ""}. Prefer inbox?{" "}
              <a
                href={RESWELL_CONTACT_MAILTO}
                className="font-medium text-[#001A4A] underline underline-offset-4"
              >
                {RESWELL_CONTACT_EMAIL}
              </a>
              .
              {ticketId ? (
                <>
                  {" "}
                  If you have a Reswell account, you can also follow up in{" "}
                  <Link
                    href="/dashboard/support"
                    className="font-medium text-[#001A4A] underline underline-offset-4"
                  >
                    Support
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.75rem] bg-white px-6 py-8 sm:px-8 sm:py-10"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shop-partner-name" className="text-[#001A4A]">
            Your name
          </Label>
          <Input
            id="shop-partner-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            className="h-11 rounded-xl border-border/80"
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shop-partner-email" className="text-[#001A4A]">
            Work email
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
        <div className="space-y-2">
          <Label htmlFor="shop-partner-shop" className="text-[#001A4A]">
            Shop name
          </Label>
          <Input
            id="shop-partner-shop"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Channel Islands Surfboards"
            className="h-11 rounded-xl border-border/80"
            required
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor="shop-partner-website" className="text-[#001A4A]">
            Website or Instagram <span className="font-normal text-[#5c6b89]">(optional)</span>
          </Label>
          <Input
            id="shop-partner-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="instagram.com/yourshop"
            className="h-11 rounded-xl border-border/80"
            autoComplete="url"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shop-partner-boards" className="text-[#001A4A]">
            Boards to list soon <span className="font-normal text-[#5c6b89]">(optional)</span>
          </Label>
          <Input
            id="shop-partner-boards"
            value={boardCount}
            onChange={(e) => setBoardCount(e.target.value)}
            placeholder="e.g. 8–12 trade-ins"
            className="h-11 rounded-xl border-border/80"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="shop-partner-message" className="text-[#001A4A]">
            Anything else? <span className="font-normal text-[#5c6b89]">(optional)</span>
          </Label>
          <Textarea
            id="shop-partner-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Used rack size, pickup preference, Shopify store, etc."
            rows={4}
            className="min-h-[110px] resize-y rounded-xl border-border/80"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-11 min-w-[200px] rounded-full bg-[#001A4A] px-8 font-semibold text-white hover:bg-[#001A4A]/90"
        >
          {loading ? (
            "Sending…"
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Apply for the offer
            </>
          )}
        </Button>
        <p className="text-xs leading-relaxed text-[#5c6b89] sm:max-w-[240px] sm:text-right">
          No public promo code — we verify shops, then unlock the fee waiver.
        </p>
      </div>
    </form>
  )
}
