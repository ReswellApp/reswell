import Image from 'next/image'
import Link from 'next/link'
import { Mail, MapPin, Phone, Store } from 'lucide-react'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { profileMediaDisplaySrc } from '@/lib/public-media-display-src'
import { sellerProfileHref } from '@/lib/seller-slug'
import type { AdminUserDetailProfileRow } from '@/lib/services/adminUserDetail'
import { adminUserLocation } from '@/lib/admin/admin-user-detail-display'

interface AdminUserDetailIdentityProps {
  profile: AdminUserDetailProfileRow
  listingsCount: number
}

export function AdminUserDetailIdentity({ profile, listingsCount }: AdminUserDetailIdentityProps) {
  const name = profile.display_name || 'No name'
  const legalName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const location = adminUserLocation(profile)
  const shopHref = profile.seller_slug ? sellerProfileHref(profile) : null
  const avatarSrc = profileMediaDisplaySrc(profile.avatar_url)

  return (
    <section className="admin-surface p-5">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
          {avatarSrc ? (
            <Image src={avatarSrc} alt="" fill className="object-cover" unoptimized={avatarSrc.startsWith('/')} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
              {name[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div>
            <h2 className="truncate font-headline text-lg font-semibold text-foreground">{name}</h2>
            {legalName && legalName !== name ? (
              <p className="text-sm text-muted-foreground">{legalName}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.is_admin ? <AdminStatusPill label="Admin" tone="violet" /> : null}
            {profile.is_employee ? <AdminStatusPill label="Employee" tone="blue" /> : null}
            {!profile.is_admin && !profile.is_employee && listingsCount > 0 ? (
              <AdminStatusPill label="Seller" tone="green" />
            ) : null}
            {profile.is_reswell_seller ? <AdminStatusPill label="Reswell seller" tone="amber" /> : null}
            {profile.shop_verified ? <AdminStatusPill label="Verified" tone="blue" /> : null}
            {profile.is_shop ? <AdminStatusPill label="Shop" tone="slate" /> : null}
          </div>
        </div>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        {profile.email ? (
          <div className="flex items-start gap-2 text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`mailto:${profile.email}`} className="break-all hover:underline">
              {profile.email}
            </a>
          </div>
        ) : null}
        {profile.phone ? (
          <div className="flex items-start gap-2 text-foreground">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{profile.phone}</span>
          </div>
        ) : null}
        {location ? (
          <div className="flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{location}</span>
          </div>
        ) : null}
        {profile.shop_name || shopHref ? (
          <div className="flex items-start gap-2 text-foreground">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              {profile.shop_name ? <p>{profile.shop_name}</p> : null}
              {shopHref ? (
                <Link href={shopHref} target="_blank" className="text-xs text-[hsl(var(--admin-teal))] hover:underline">
                  {shopHref}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </dl>

      {profile.bio ? (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
      ) : null}
    </section>
  )
}
