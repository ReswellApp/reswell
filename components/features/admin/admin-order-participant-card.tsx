import Link from "next/link"
import Image from "next/image"
import { ExternalLink, Mail, MapPin, Phone, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import type { AdminOrderParticipant } from "@/lib/db/adminOrders"
import { format } from "date-fns"

type AdminOrderParticipantCardProps = {
  role: "Buyer" | "Seller"
  participant: AdminOrderParticipant
}

function participantDisplayName(participant: AdminOrderParticipant): string {
  if (participant.is_shop && participant.shop_name?.trim()) {
    return participant.shop_name.trim()
  }
  if (participant.display_name?.trim()) {
    return participant.display_name.trim()
  }
  if (participant.email?.trim()) {
    return participant.email.trim()
  }
  return `${participant.id.slice(0, 8)}…`
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  )
}

export function AdminOrderParticipantCard({ role, participant }: AdminOrderParticipantCardProps) {
  const name = participantDisplayName(participant)
  const location = [participant.city, participant.state].filter(Boolean).join(", ")

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden />
          {role}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-start gap-3">
          {participant.avatar_url ? (
            <Image
              src={participant.avatar_url}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="h-5 w-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{name}</p>
              {role === "Seller" && participant.shop_verified ? <VerifiedBadge /> : null}
            </div>
            {participant.display_name?.trim() &&
            participant.is_shop &&
            participant.shop_name?.trim() &&
            participant.display_name.trim() !== participant.shop_name.trim() ? (
              <p className="text-muted-foreground text-xs">Profile: {participant.display_name}</p>
            ) : null}
            <p className="font-mono text-xs text-muted-foreground break-all">{participant.id}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Email" value={participant.email} />
          <DetailRow label="Location" value={location || null} />
          <DetailRow label="Shop phone" value={participant.shop_phone} />
          <DetailRow label="Shop address" value={participant.shop_address} />
          <DetailRow label="Seller slug" value={participant.seller_slug} />
          <DetailRow
            label="Member since"
            value={
              participant.created_at
                ? format(new Date(participant.created_at), "MMM d, yyyy")
                : null
            }
          />
          {role === "Seller" ? (
            <DetailRow
              label="Sales count"
              value={
                participant.sales_count != null ? String(participant.sales_count) : null
              }
            />
          ) : null}
        </div>

        {participant.bio?.trim() ? (
          <div>
            <p className="text-muted-foreground text-xs">Bio</p>
            <p className="whitespace-pre-wrap break-words">{participant.bio}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={`/admin/users/${participant.id}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Admin profile
            </Link>
          </Button>
          {participant.email ? (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a href={`mailto:${participant.email}`}>
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </a>
            </Button>
          ) : null}
          {role === "Seller" && participant.seller_slug ? (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link href={`/sellers/${participant.seller_slug}`} target="_blank">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Public shop
              </Link>
            </Button>
          ) : null}
          {participant.shop_phone ? (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <a href={`tel:${participant.shop_phone}`}>
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Call
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
