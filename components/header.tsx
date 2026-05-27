"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  Suspense,
  type MouseEvent,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import {
  X,
  Menu,
  Search,
  MessageSquare,
  User,
  Heart,
  Plus,
  ChevronDown,
  Clock,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { HeaderNavSearch } from "@/components/header-nav-search"
import { SiteSearchBar, siteSearchInputClassName, SITE_FILTER_BAR_HEIGHT } from "@/components/site-search-bar"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { forceReleaseBodyScrollLock, useBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { reconcileWalletAggregates } from "@/lib/wallet-reconcile"
import { clearNavSearchQuery, writeNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { navigateToBrandProfileFromNavPick } from "@/lib/nav-marketplace-brand-search"
import {
  boardBrowseNavItemIsActive,
  siteHeaderSecondaryNavLinks,
  siteHeaderSecondaryNavItemIsActive,
  surfboardBrowseLinks,
} from "@/lib/site-category-directory"
import { siteFooterNavLinks } from "@/lib/site-footer-nav"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { headerDisplayName, headerInitialFromDisplayName } from "@/lib/header-user-display"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import {
  HEADER_AUTH_REFRESH_EVENT,
  type HeaderAuthRefreshDetail,
} from "@/lib/auth/header-auth-refresh"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import type { SiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import { CartHeaderLink } from "@/components/cart-header-link"
import { HeaderAccountMenu } from "@/components/header-account-menu"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { HeaderMobileCategoryBar } from "@/components/header-mobile-category-bar"
import { Skeleton } from "@/components/ui/skeleton"
import type { User as SupabaseUser } from "@supabase/supabase-js"

/** Post-auth destination when a guest taps “List your board” in the header. */
const GUEST_SELL_REDIRECT = "/sell"

/** Matches main nav search bar height (`SITE_FILTER_BAR_HEIGHT` / `h-12`). */
const listYourBoardNavButtonClassName = cn(
  SITE_FILTER_BAR_HEIGHT,
  "shrink-0 whitespace-nowrap rounded-full border-foreground/20 px-5 text-[14px] font-medium",
)

/** Guest “Recently sold” nav control — larger tap target (Clock icon, links to `/sold`). */
const recentlySoldNavButtonClassName =
  "h-11 w-14 shrink-0 px-0 text-foreground hover:bg-muted sm:h-12 sm:w-[3.75rem]"
const recentlySoldNavIconClassName = "h-8 w-8 sm:h-9 sm:w-9"

function HeaderMobileNavActionsSkeleton() {
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-1.5"
      aria-busy="true"
      aria-label="Loading navigation"
    >
      <Skeleton className="h-4 w-14 shrink-0 rounded" />
      <Skeleton className="h-11 w-14 shrink-0 rounded-lg" />
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
    </div>
  )
}

function HeaderDesktopNavActionsSkeleton() {
  return (
    <div
      className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-0.5"
      aria-busy="true"
      aria-label="Loading navigation"
    >
      <Skeleton className="hidden h-12 w-[9.5rem] shrink-0 rounded-full lg:mr-10 lg:block" />
      <Skeleton className="hidden h-4 w-11 shrink-0 rounded lg:block" />
      <Skeleton className="hidden h-11 w-14 shrink-0 rounded-lg lg:block" />
      <Skeleton className="hidden h-10 w-10 shrink-0 rounded-lg lg:block" />
      <Skeleton className="hidden h-10 w-10 shrink-0 rounded-lg lg:block" />
      <Skeleton className="hidden h-10 w-10 shrink-0 rounded-lg sm:block" />
      <Skeleton className="hidden h-12 w-36 shrink-0 rounded-full sm:block lg:hidden" />
      <Skeleton className="hidden h-4 w-14 shrink-0 rounded sm:block lg:hidden" />
      <Skeleton className="h-9 w-9 shrink-0 rounded-full sm:ml-2 md:ml-4" />
    </div>
  )
}

type ProfileAvatarFields = {
  avatar_url: string | null
  shop_logo_url: string | null
  is_shop: boolean | null
}

type HeaderDerivedNavState = {
  user: SupabaseUser | null
  profileAvatarUrl: string | null
  profileDisplayName: string | null
  isAdmin: boolean
  unreadMessages: number
  walletBalance: number | null
  authLoaded: boolean
}

function deriveHeaderNavState(payload: SiteChromeAuthPayload): HeaderDerivedNavState {
  if (!payload.user) {
    return {
      user: null,
      profileAvatarUrl: null,
      profileDisplayName: null,
      isAdmin: false,
      unreadMessages: 0,
      walletBalance: null,
      authLoaded: true,
    }
  }
  const b = payload.bootstrap
  if (!b?.profile) {
    return {
      user: payload.user,
      profileAvatarUrl: resolveHeaderAvatarUrl(payload.user, null),
      profileDisplayName: null,
      isAdmin: false,
      unreadMessages: 0,
      walletBalance: null,
      authLoaded: false,
    }
  }
  const prof = b.profile
  return {
    user: payload.user,
    profileAvatarUrl: resolveHeaderAvatarUrl(payload.user, prof),
    profileDisplayName: prof.display_name,
    isAdmin: prof.is_admin === true,
    unreadMessages: b.unreadMessages,
    walletBalance: b.walletBalance,
    authLoaded: true,
  }
}

/**
 * Shop logo when `is_shop`; else `profiles.avatar_url`; else Google OAuth `avatar_url` / `picture` in user_metadata.
 */
function resolveHeaderAvatarUrl(
  user: SupabaseUser,
  profile: ProfileAvatarFields | null
): string | null {
  const trim = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const oauth =
    (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta?.picture === "string" && meta.picture.trim()) ||
    null

  if (profile?.is_shop && trim(profile.shop_logo_url)) {
    return trim(profile.shop_logo_url)
  }
  return trim(profile?.avatar_url) || oauth
}

/** Desktop + mobile: “All Surfboards” first, then each `type=` link (order from {@link surfboardBrowseLinks}). */
const boardShapeNav = surfboardBrowseLinks.map((link) => ({
  name: link.label,
  href: link.href,
}))

function isSearchResultsPath(p: string) {
  return p === "/search" || p === "/search/recent"
}

/** `/search` opened from header overlay / compact nav — drives analytics `nq=1` + category carry-over. */
function marketplaceNavSearchHref(
  rawQuery: string,
  pathname: string | null,
  categorySource: Pick<URLSearchParams, "get">,
): string {
  const params = new URLSearchParams()
  params.set("q", rawQuery.trim())
  params.set("nq", "1")
  const cat = isSearchResultsPath(pathname ?? "") ? categorySource.get("category") : null
  if (cat?.trim()) params.set("category", cat.trim())
  return `/search?${params.toString()}`
}

const CATEGORY_BAR_GAP_PX = 32

/**
 * When the header row is narrower than this (split view, small tablets, etc.),
 * hide the inline search and use the icon + hamburger instead so the bar
 * stays usable. Typical iPad portrait (~810px+) stays above this.
 */
const HEADER_ROW_COMPACT_BELOW_PX = 800

/** How many shape links fit before moving the rest into a "More" menu. */
function computeVisibleBoardShapeCount(
  availableWidth: number,
  linkWidths: number[],
  moreWidth: number,
  gapPx: number
): number {
  const n = linkWidths.length
  if (n === 0) return 0
  const allFit =
    linkWidths.reduce((a, b) => a + b, 0) + Math.max(0, n - 1) * gapPx
  if (allFit <= availableWidth) return n

  for (let k = n - 1; k >= 0; k--) {
    const sumLinks = linkWidths.slice(0, k).reduce((a, b) => a + b, 0)
    const gaps = k
    const total = sumLinks + moreWidth + gaps * gapPx
    if (total <= availableWidth) return k
  }
  return 0
}

/** Ignore sub-pixel noise from getBoundingClientRect */
function widthsLookReady(widths: number[]): boolean {
  return widths.length > 0 && widths.some((w) => w >= 0.75)
}

function HeaderDesktopCategoryBar({
  pathname,
  headerSearchParams,
}: {
  pathname: string | null
  headerSearchParams: URLSearchParams
}) {
  const leftSlotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const zeroWidthRetriesRef = useRef(0)
  /** `null` until the first layout pass has real link widths (avoids a flash of all links then a jump into "More"). */
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  const recalc = useCallback(() => {
    const slot = leftSlotRef.current
    const measure = measureRef.current
    if (!slot || !measure) return
    const available = slot.clientWidth
    if (available <= 0) {
      // Flex slot often reports 0 before first layout — retry on the next frame (bounded).
      if (zeroWidthRetriesRef.current < 8) {
        zeroWidthRetriesRef.current += 1
        requestAnimationFrame(() => recalc())
      }
      return
    }
    zeroWidthRetriesRef.current = 0

    const linkEls = measure.querySelectorAll<HTMLElement>("[data-nav-measure='link']")
    const moreEl = measure.querySelector<HTMLElement>("[data-nav-measure='more']")
    const linkWidths = Array.from(linkEls).map((el) => el.getBoundingClientRect().width)
    const moreW = Math.max(moreEl?.getBoundingClientRect().width ?? 72, 1)

    // Before fonts / first paint, widths can be 0 — don't collapse the bar to 0 visible links.
    if (!widthsLookReady(linkWidths)) {
      return
    }

    let next = computeVisibleBoardShapeCount(available, linkWidths, moreW, CATEGORY_BAR_GAP_PX)
    if (next === 0 && available >= 360 && linkWidths.length > 0) {
      next = 1
    }
    setVisibleCount((prev) => (prev === next ? prev : next))
  }, [])

  useLayoutEffect(() => {
    const run = () => {
      recalc()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => recalc())
      })
    }
    run()
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => recalc())
    }
    const slot = leftSlotRef.current
    if (!slot) return
    const ro = new ResizeObserver(() => recalc())
    ro.observe(slot)
    window.addEventListener("resize", recalc)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", recalc)
    }
  }, [recalc])

  /** If measurement never resolves (e.g. unusual font timing), show all links rather than skeleton forever. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setVisibleCount((v) => (v === null ? boardShapeNav.length : v))
    }, 2500)
    return () => window.clearTimeout(id)
  }, [])

  const layoutReady = visibleCount !== null
  const visibleNav = layoutReady ? boardShapeNav.slice(0, visibleCount) : []
  const overflowNav = layoutReady ? boardShapeNav.slice(visibleCount) : []
  const showMore = layoutReady && overflowNav.length > 0

  return (
    <div className="relative hidden border-t border-border md:block">
      <div
        ref={measureRef}
        className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] flex items-center gap-8 whitespace-nowrap opacity-0"
        aria-hidden
      >
        {boardShapeNav.map((item) => (
          <span key={item.href} data-nav-measure="link" className="shrink-0 py-4 text-[15px]">
            {item.name}
          </span>
        ))}
        <span data-nav-measure="more" className="flex shrink-0 items-center gap-1 py-4 text-[15px]">
          More
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </span>
      </div>

      <div className="container mx-auto flex min-w-0 items-stretch">
        <div
          ref={leftSlotRef}
          className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden"
          aria-busy={!layoutReady}
        >
          {!layoutReady
            ? boardShapeNav.slice(0, 8).map((item, i) => (
                <Skeleton
                  key={item.href}
                  className="h-4 shrink-0 self-center"
                  style={{ width: `${52 + (i % 6) * 14}px` }}
                />
              ))
            : visibleNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={boardsBrowseLinkPrefetch(item.href)}
                  className={`cat-link shrink-0 py-4 text-[15px] transition-colors duration-smooth ${
                    boardBrowseNavItemIsActive(pathname, headerSearchParams, item.href)
                      ? "cat-link--active font-medium"
                      : ""
                  }`}
                >
                  {item.name}
                </Link>
              ))}

          {showMore ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="cat-link flex shrink-0 items-center gap-1 py-4 text-[15px] transition-colors duration-smooth focus:outline-none">
                More
                <ChevronDown className="h-4 w-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 [&_a]:!text-muted-foreground [&_a:hover]:!text-foreground [&_a[data-highlighted]]:!text-foreground [&_a:focus]:!text-foreground"
              >
                {overflowNav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} prefetch={boardsBrowseLinkPrefetch(item.href)} className="w-full">
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <nav
          className="ml-6 flex shrink-0 items-center gap-8 border-l border-border pl-8"
          aria-label="Editorial and community"
        >
          {siteHeaderSecondaryNavLinks.map((item) => {
            const active = siteHeaderSecondaryNavItemIsActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cat-link py-4 text-[15px] transition-colors duration-smooth ${
                  active ? "cat-link--active font-medium" : ""
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function Header({ serverHeaderAuth }: { serverHeaderAuth: SiteChromeAuthPayload }) {
  const initNav = deriveHeaderNavState(serverHeaderAuth)
  const [user, setUser] = useState<SupabaseUser | null>(initNav.user)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(initNav.profileAvatarUrl)
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(initNav.profileDisplayName)
  const [isAdmin, setIsAdmin] = useState(initNav.isAdmin)
  const [unreadMessages, setUnreadMessages] = useState(initNav.unreadMessages)
  const [walletBalance, setWalletBalance] = useState<number | null>(initNav.walletBalance)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileLogoHovered, setMobileLogoHovered] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // CLS-FIX: track when auth check has resolved so we can reserve the
  // correct amount of space for auth-dependent action buttons before they
  // appear, preventing the search bar from shifting horizontally.
  const [authLoaded, setAuthLoaded] = useState(initNav.authLoaded)
  /** When the image URL is set but fails to load (403, blocked, bad URL), hide img so fallback letter shows. */
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const headerMainRowRef = useRef<HTMLDivElement>(null)
  const headerShellRef = useRef<HTMLElement>(null)
  const [headerRowCompact, setHeaderRowCompact] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const headerSearchParams = useClientSearchParams()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMobileMenuOpen(false)
    forceReleaseBodyScrollLock()
  }, [pathname, headerSearchParams.toString()])

  const onHeaderShellClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest("a")
    if (!anchor || !headerShellRef.current?.contains(anchor)) return
    setMobileMenuOpen(false)
    forceReleaseBodyScrollLock()
  }, [])

  const { openLogin } = useAuthModal()
  const isMobileViewport = useIsMobile()

  const resolvedDisplayName = useMemo(
    () => (user ? headerDisplayName(profileDisplayName, user) : ""),
    [user, profileDisplayName],
  )
  const resolvedInitial = useMemo(
    () => headerInitialFromDisplayName(resolvedDisplayName || "User"),
    [resolvedDisplayName],
  )

  useEffect(() => {
    setAvatarImageFailed(false)
  }, [profileAvatarUrl])

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("")
      clearNavSearchQuery()
    }
  }, [searchOpen])

  useEffect(() => {
    if (!isSearchResultsPath(pathname ?? "")) return
    const qFromUrl = headerSearchParams.get("q")?.trim() ?? ""
    if (!qFromUrl) return
    setSearchQuery(qFromUrl)
    writeNavSearchQuery(qFromUrl)
  }, [pathname, headerSearchParams])

  const headerAuthDigest = useMemo(() => {
    const u = serverHeaderAuth.user
    const b = serverHeaderAuth.bootstrap
    if (!u) return "guest"
    return [
      u.id,
      typeof (u as { updated_at?: string }).updated_at === "string"
        ? (u as { updated_at: string }).updated_at
        : "",
      b?.walletBalance ?? "",
      b?.unreadMessages ?? "",
      b?.profile?.display_name ?? "",
      b?.profile?.avatar_url ?? "",
      b?.profile?.shop_logo_url ?? "",
      String(b?.profile?.is_admin ?? ""),
    ].join("|")
  }, [
    serverHeaderAuth.user?.id,
    (serverHeaderAuth.user as { updated_at?: string } | null | undefined)?.updated_at,
    serverHeaderAuth.bootstrap?.walletBalance,
    serverHeaderAuth.bootstrap?.unreadMessages,
    serverHeaderAuth.bootstrap?.profile?.display_name,
    serverHeaderAuth.bootstrap?.profile?.avatar_url,
    serverHeaderAuth.bootstrap?.profile?.shop_logo_url,
    serverHeaderAuth.bootstrap?.profile?.is_admin,
  ])

  useLayoutEffect(() => {
    const d = deriveHeaderNavState(serverHeaderAuth)
    // Soft `router.refresh()` after OAuth can return a guest snapshot before cookies are
    // visible to RSC — do not paint logged-out over a verified client session.
    if (!d.user && user) return
    setUser(d.user)
    setProfileAvatarUrl(d.profileAvatarUrl)
    setProfileDisplayName(d.profileDisplayName)
    setIsAdmin(d.isAdmin)
    setUnreadMessages(d.unreadMessages)
    setWalletBalance(d.walletBalance)
    // Never drop back to skeleton / logged-out chrome while the client session is still valid.
    setAuthLoaded(d.user ? d.authLoaded || Boolean(user) : d.authLoaded)
    // headerAuthDigest is the meaningful identity of the server snapshot for this tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerAuthDigest])

  const refetchFromClient = useCallback(async () => {
    if (user) setAuthLoaded(true)
    try {
      const userResult = await getAuthUserWithRetry(supabase)
      if (!userResult.ok) {
        console.warn(
          "[header] client refetch getUser failed; keeping current UI:",
          userResult.error,
        )
        return
      }
      const resolvedUser = userResult.user
      setUser(resolvedUser)
      if (!resolvedUser) {
        const guest = deriveHeaderNavState({ user: null, bootstrap: null })
        setProfileAvatarUrl(guest.profileAvatarUrl)
        setProfileDisplayName(guest.profileDisplayName)
        setIsAdmin(guest.isAdmin)
        setUnreadMessages(guest.unreadMessages)
        setWalletBalance(guest.walletBalance)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, avatar_url, display_name, shop_logo_url, is_shop")
        .eq("id", resolvedUser.id)
        .single()
      setIsAdmin(profile?.is_admin || false)
      setProfileAvatarUrl(resolveHeaderAvatarUrl(resolvedUser, profile))
      setProfileDisplayName(profile?.display_name || null)

      const { data: unreadMsgCount } = await supabase.rpc("get_unread_message_count", {
        uid: resolvedUser.id,
      })
      setUnreadMessages(Number(unreadMsgCount ?? 0))

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
        .eq("user_id", resolvedUser.id)
        .single()
      setWalletBalance(wallet ? reconcileWalletAggregates(wallet).totalBalance : 0)
    } finally {
      setAuthLoaded(true)
    }
  }, [supabase, user])

  useEffect(() => {
    if (authLoaded) return
    if (!user) return
    void refetchFromClient()
  }, [authLoaded, user, refetchFromClient])

  /** Server saw the OAuth cookies before the browser client storage caught up. */
  useEffect(() => {
    const serverUser = serverHeaderAuth.user
    if (!serverUser) return

    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled || data.session?.user) return
      const session = await waitForClientSession({ supabase })
      if (cancelled || !session?.user) return
      await refetchFromClient()
      router.refresh()
    })()

    return () => {
      cancelled = true
    }
  }, [serverHeaderAuth.user?.id, supabase, refetchFromClient, router])

  useEffect(() => {
    function onHeaderAuthRefresh(event: Event) {
      const detail = (event as CustomEvent<HeaderAuthRefreshDetail>).detail
      if (detail?.displayName?.trim()) {
        setProfileDisplayName(detail.displayName.trim())
        setAuthLoaded(true)
      }
      if (detail?.avatarUrl?.trim()) {
        setProfileAvatarUrl(detail.avatarUrl.trim())
        setAuthLoaded(true)
      }
      void refetchFromClient()
    }
    window.addEventListener(HEADER_AUTH_REFRESH_EVENT, onHeaderAuthRefresh)

    async function refreshUnreadCount() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) return
      const { data: unreadMsgCount } = await supabase.rpc("get_unread_message_count", { uid: u.id })
      setUnreadMessages(Number(unreadMsgCount ?? 0))
    }
    window.addEventListener("unreadCountRefresh", refreshUnreadCount)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session?.user) {
          setUser(session.user)
          void refetchFromClient()
        }
        return
      }

      if (event === "SIGNED_OUT") {
        const guest = deriveHeaderNavState({ user: null, bootstrap: null })
        setUser(guest.user)
        setProfileAvatarUrl(guest.profileAvatarUrl)
        setProfileDisplayName(guest.profileDisplayName)
        setIsAdmin(guest.isAdmin)
        setUnreadMessages(guest.unreadMessages)
        setWalletBalance(guest.walletBalance)
        setAuthLoaded(true)
        router.refresh()
        return
      }

      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        session?.user
      ) {
        setUser(session.user)
        setAuthLoaded(true)
        void refetchFromClient()
      }
    })

    return () => {
      window.removeEventListener(HEADER_AUTH_REFRESH_EVENT, onHeaderAuthRefresh)
      window.removeEventListener("unreadCountRefresh", refreshUnreadCount)
      subscription.unsubscribe()
    }
  }, [supabase, router, refetchFromClient])

  /** Keep dropdown earnings in sync when `wallets` changes (e.g. admin reset, sales, payouts). */
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`header_wallet_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, user?.id])

  /** Ledger rows (refunds, sales, cash-out) — header should resync even if a `wallets` UPDATE is batched oddly. */
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`header_wallet_tx_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wallet_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, user?.id])

  /** Avatar, display name, shop logo: stay in sync when `profiles` row updates (any client or API path). */
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`header_profile_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, user?.id])

  /** Lightweight wallet-only resync on route changes — catches staleness when Realtime misses an update. */
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase
      .from("wallets")
      .select("balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .eq("user_id", user.id)
      .single()
      .then(({ data: wallet }) => {
        if (!cancelled && wallet) {
          setWalletBalance(reconcileWalletAggregates(wallet).totalBalance)
        }
      })
    return () => { cancelled = true }
  }, [supabase, user?.id, pathname])

  useBodyScrollLock(mobileMenuOpen)

  useEffect(() => {
    if (!mobileMenuOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mobileMenuOpen])

  /** Hamburger + slide-out are lg-only; close when crossing desktop width so scroll lock cannot stick. */
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(min-width: 1024px)")
    const closeIfDesktop = () => {
      if (mq.matches) setMobileMenuOpen(false)
    }
    mq.addEventListener("change", closeIfDesktop)
    closeIfDesktop()
    return () => mq.removeEventListener("change", closeIfDesktop)
  }, [])

  useLayoutEffect(() => {
    const el = headerMainRowRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      setHeaderRowCompact(w < HEADER_ROW_COMPACT_BELOW_PX)
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Close drawer immediately so scroll-lock cleanup runs before route transition. */
  const onMobileDrawerLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    setMobileMenuOpen(false)
  }, [])

  function handleSignOut() {
    setUser(null)
    setAuthLoaded(true)
    forceReleaseBodyScrollLock()
    window.location.assign("/")
    void supabase.auth.signOut().catch(() => {})
  }

  const accountMenu =
    user ? (
      <HeaderAccountMenu
        user={user}
        profileAvatarUrl={profileAvatarUrl}
        avatarImageFailed={avatarImageFailed}
        onAvatarImageFailed={() => setAvatarImageFailed(true)}
        resolvedInitial={resolvedInitial}
        resolvedDisplayName={resolvedDisplayName}
        walletBalance={walletBalance}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
      />
    ) : null

  /** Sell flow and checkout: logo + account only (no main nav / search / cart). */
  const isMinimalNavChrome =
    pathname !== null &&
    (pathname === "/sell" ||
      pathname.startsWith("/sell/") ||
      pathname === "/checkout" ||
      pathname.startsWith("/checkout/"))

  const headerSearchOverlayForm = (
    <SiteSearchBar
      compact
      onSubmit={async (e) => {
        e.preventDefault()
        const q = searchQuery.trim()
        if (!q) {
          clearNavSearchQuery()
          setSearchQuery("")
          setSearchOpen(false)
          await goToCuratedSearchPage(router, pathname, headerSearchParams.toString())
          return
        }
        const href = marketplaceNavSearchHref(q, pathname, headerSearchParams)
        setSearchQuery(q)
        writeNavSearchQuery(q)
        router.push(href)
        setSearchOpen(false)
      }}
      className="w-full"
    >
      <SearchInputWithSuggest
        value={searchQuery}
        onChange={setSearchQuery}
        onBrandStripPick={(brandName, resolved) => {
          if (resolved?.catalogSlug) {
            router.push(`${BRANDS_BASE}/${encodeURIComponent(resolved.catalogSlug)}`)
          } else {
            void navigateToBrandProfileFromNavPick(router, brandName, {
              categorySlug: isSearchResultsPath(pathname ?? "")
                ? headerSearchParams.get("category")
                : null,
              navSubmitted: true,
            })
          }
          setSearchQuery("")
          clearNavSearchQuery()
          setSearchOpen(false)
        }}
        onSelect={(text) => {
          const term = text.trim()
          if (!term) return
          setSearchQuery(term)
          writeNavSearchQuery(term)
          router.push(marketplaceNavSearchHref(term, pathname, headerSearchParams))
          setSearchOpen(false)
        }}
        onNavigate={() => {
          setSearchQuery("")
          clearNavSearchQuery()
          setSearchOpen(false)
        }}
        placeholder="Search surfboards…"
        section=""
        listboxId="nav-search-suggestions-tablet"
        inputClassName={siteSearchInputClassName({ compact: true })}
        className="w-full"
        autoFocus={searchOpen}
        analyticsSurface="header_nav"
        showTextSuggestions={false}
        matchAnchorWidth
      />
    </SiteSearchBar>
  )

  if (isMinimalNavChrome) {
    return (
      <header
        ref={headerShellRef}
        onClick={onHeaderShellClick}
        className="relative z-50 w-full border-b border-border bg-background shadow-sm"
      >
        <div className="container mx-auto flex min-h-[56px] min-w-0 items-center justify-between gap-4 px-4 py-2 sm:min-h-[64px] md:min-h-[80px] sm:px-6">
          <SiteWordmarkLink />
          <div className="flex shrink-0 items-center justify-end">
            {!authLoaded ? (
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" aria-hidden />
            ) : user && accountMenu ? (
              accountMenu
            ) : authLoaded ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-foreground"
                onClick={() => openLogin()}
                aria-label="Log in or sign up"
              >
                <User className="h-6 w-6" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      {/* CLS-FIX: explicit min-h locks the header row height before fonts and
          auth state resolve, so content below never shifts vertically. */}
      <header
        ref={headerShellRef}
        onClick={onHeaderShellClick}
        className="relative z-50 w-full border-b border-border bg-background shadow-sm"
      >
        <div
          ref={headerMainRowRef}
          className={cn(
            "container mx-auto min-w-0",
            isMobileViewport
              ? "flex flex-col gap-2 py-2 pb-2.5"
              : "flex min-h-[56px] items-center gap-2 py-2 sm:min-h-[64px] sm:py-2.5 md:min-h-[80px] md:gap-4 md:py-3",
          )}
        >
          {isMobileViewport ? (
            <>
              <div className="flex min-h-[48px] min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SiteWordmarkLink compact className="px-1 py-1 sm:px-2 sm:py-1.5" />
                </div>
                <div className="flex shrink-0 items-center justify-end gap-0.5">
                  {!authLoaded ? (
                    <HeaderMobileNavActionsSkeleton />
                  ) : user ? (
                    <>
                      <Link href="/favorites" className="inline-flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-foreground hover:bg-black/5"
                          aria-label="Favorites"
                        >
                          <Heart className="h-[22px] w-[22px]" />
                        </Button>
                      </Link>
                      <Link href="/messages" className="relative inline-flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-foreground hover:bg-black/5"
                        >
                          <MessageSquare className="h-[22px] w-[22px]" />
                          <NavUnreadCountBadge count={unreadMessages} overlay />
                          <span className="sr-only">Messages</span>
                        </Button>
                      </Link>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-foreground hover:bg-black/5"
                      >
                        <Link
                          href="/sell?new=1"
                          aria-label="Create listing"
                        >
                          <Plus className="h-[22px] w-[22px]" aria-hidden />
                        </Link>
                      </Button>
                      <div className="shrink-0">{accountMenu}</div>
                      <CartHeaderLink
                        showOnNarrowScreens
                        authResolved={authLoaded}
                        userId={user?.id ?? null}
                      />
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                          e.preventDefault()
                          openLogin()
                        }}
                        className="shrink-0 whitespace-nowrap px-1 py-2 text-[15px] font-medium text-foreground"
                      >
                        Log in
                      </Link>
                      <Link href="/sold" className="inline-flex shrink-0" title="Recently sold">
                        <Button
                          variant="ghost"
                          className={cn(recentlySoldNavButtonClassName, "hover:bg-black/5")}
                          aria-label="Recently sold"
                        >
                          <Clock className={recentlySoldNavIconClassName} />
                        </Button>
                      </Link>
                      <CartHeaderLink
                        showOnNarrowScreens
                        authResolved={authLoaded}
                        userId={user?.id ?? null}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "bg-muted text-foreground hover:bg-lightgray/80",
                  )}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <Suspense
                  fallback={
                    <Skeleton
                      className="h-10 min-h-[2.5rem] min-w-0 flex-1 rounded-full"
                      aria-hidden
                    />
                  }
                >
                  <HeaderNavSearch variant="mobile" />
                </Suspense>
              </div>
              <HeaderMobileCategoryBar />
            </>
          ) : (
            <>
          {/* Logo + home link; padding keeps white breathing room around the mark */}
          <SiteWordmarkLink />

          {/* Main search (md+ when row is wide enough); icon + drawer when row is cramped */}
          {!headerRowCompact ? (
            <Suspense
              fallback={
                <div className="hidden min-w-0 flex-1 px-2 md:block" aria-hidden>
                  <Skeleton className="h-10 min-h-[2.5rem] w-full rounded-full" />
                </div>
              }
            >
              <HeaderNavSearch />
            </Suspense>
          ) : null}

          {/* CLS-FIX: actions area keeps a stable minimum width while auth loads.
              The invisible placeholder reserves space equal to the logged-in
              desktop layout so the search bar never shifts horizontally. */}
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5 md:gap-0.5 text-foreground">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "flex h-10 w-10 text-foreground hover:bg-muted",
                    !headerRowCompact && "md:hidden",
                  )}
                  aria-label="Search"
                >
                  <Search className="h-[22px] w-[22px]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[min(100vw-2rem,380px)] rounded-xl border border-border bg-popover p-4 shadow-lg"
                align="center"
                sideOffset={8}
              >
                {headerSearchOverlayForm}
              </PopoverContent>
            </Popover>

            {!authLoaded ? (
              <HeaderDesktopNavActionsSkeleton />
            ) : (
              <>
            {user ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-foreground hover:bg-muted"
              >
                <Link href="/sell?new=1" aria-label="Create listing">
                  <Plus className="h-[22px] w-[22px]" aria-hidden />
                </Link>
              </Button>
            ) : null}

            {!user ? (
              <Button
                asChild
                variant="outline"
                className={cn(listYourBoardNavButtonClassName, "hidden lg:mr-10 lg:inline-flex")}
              >
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(GUEST_SELL_REDIRECT)}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                    e.preventDefault()
                    openLogin(GUEST_SELL_REDIRECT)
                  }}
                >
                  List your board
                </Link>
              </Button>
            ) : null}

            {!user ? (
              <Link
                href="/about"
                className="hidden lg:inline-flex text-[15px] font-medium text-foreground/80 transition-colors hover:text-cerulean px-3 py-2"
              >
                About
              </Link>
            ) : null}

            {!user ? (
              <Link href="/sold" className="hidden lg:inline-flex" title="Recently sold">
                <Button variant="ghost" className={recentlySoldNavButtonClassName}>
                  <Clock className={recentlySoldNavIconClassName} />
                  <span className="sr-only">Recently sold</span>
                </Button>
              </Link>
            ) : null}

            <Link
              href={
                user
                  ? "/favorites"
                  : `/auth/login?redirect=${encodeURIComponent("/favorites")}`
              }
              className="hidden lg:inline-flex"
              onClick={
                user
                  ? undefined
                  : (e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      openLogin("/favorites")
                    }
              }
            >
              <Button variant="ghost" size="icon" className="text-foreground">
                <Heart className="h-6 w-6" />
                <span className="sr-only">Favorites</span>
              </Button>
            </Link>

            <CartHeaderLink
              showOnDesktopNav
              authResolved={authLoaded}
              userId={user?.id ?? null}
            />

            {user ? (
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-0.5">
                <CartHeaderLink authResolved={authLoaded} userId={user.id} />
                <Link href="/messages" className="relative inline-flex shrink-0">
                  <Button variant="ghost" size="icon" className="text-foreground">
                    <MessageSquare className="h-6 w-6" />
                    <NavUnreadCountBadge count={unreadMessages} overlay />
                    <span className="sr-only">Messages</span>
                  </Button>
                </Link>

                <div className="ml-2 shrink-0 sm:ml-3 md:ml-4 max-[360px]:hidden">
                  {accountMenu}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-0">
                <Button
                  asChild
                  variant="outline"
                  className={cn(listYourBoardNavButtonClassName, "hidden sm:inline-flex lg:hidden")}
                >
                  <Link
                    href={`/auth/login?redirect=${encodeURIComponent(GUEST_SELL_REDIRECT)}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      openLogin(GUEST_SELL_REDIRECT)
                    }}
                  >
                    List your board
                  </Link>
                </Button>
                <Link
                  href="/auth/login"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                    e.preventDefault()
                    openLogin()
                  }}
                  className="hidden sm:flex text-[15px] font-medium text-foreground/80 hover:text-cerulean transition-colors px-3 py-2"
                >
                  Log in
                </Link>
              </div>
            )}
              </>
            )}

            {/* Menu toggle: phone & tablet only (below lg). Desktop/Mac use category bar + primary nav. */}
            <button
              type="button"
              className={cn(
                "flex h-10 w-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "ml-2 lg:hidden",
                mobileLogoHovered && !mobileMenuOpen
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-border bg-white text-foreground",
              )}
              onMouseEnter={() => setMobileLogoHovered(true)}
              onMouseLeave={() => setMobileLogoHovered(false)}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
            </>
          )}
        </div>

        <HeaderDesktopCategoryBar pathname={pathname} headerSearchParams={headerSearchParams} />
      </header>

      {/* Mobile slide-out menu (pure CSS, no Radix Dialog) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-[min(400px,100vw)] max-w-full bg-background border-l shadow-xl p-4 sm:p-6 overflow-y-auto overflow-x-hidden animate-in slide-in-from-right duration-300 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-top:max(1rem,env(safe-area-inset-top))] [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-semibold text-foreground">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            {!user && authLoaded && (
              <Link
                href="/auth/login"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                  e.preventDefault()
                  openLogin()
                  setMobileMenuOpen(false)
                }}
                className="mb-6 flex min-h-touch items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90 hover:no-underline"
              >
                Sign in or create account
              </Link>
            )}
            {user && authLoaded && (
              <Link
                href="/dashboard"
                onClick={onMobileDrawerLinkClick}
                className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 no-underline transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-12 w-12 shrink-0 border border-border">
                  {profileAvatarUrl && !avatarImageFailed ? (
                    <AvatarImage
                      src={profileAvatarUrl}
                      alt=""
                      onLoadingStatusChange={(status) => {
                        if (status === "error") setAvatarImageFailed(true)
                      }}
                    />
                  ) : null}
                  <AvatarFallback className="text-lg text-foreground">{resolvedInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {resolvedDisplayName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
              </Link>
            )}
            <nav className="flex flex-col gap-1 mb-6">
              {boardShapeNav.map((item) => {
                const active = boardBrowseNavItemIsActive(pathname, headerSearchParams, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={boardsBrowseLinkPrefetch(item.href)}
                    onClick={onMobileDrawerLinkClick}
                    className={`cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center ${
                      active ? "cat-link--active" : ""
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
              <hr className="my-2 border-border" />
              {siteHeaderSecondaryNavLinks.map((item) => {
                const active = siteHeaderSecondaryNavItemIsActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileDrawerLinkClick}
                    className={`cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center ${
                      active ? "cat-link--active" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <hr className="my-2 border-border" />
              {(
                [
                  {
                    title: "Marketplace",
                    links: siteFooterNavLinks.marketplace.filter((link) => link.href !== "/boards"),
                  },
                  { title: "Support", links: siteFooterNavLinks.support },
                  { title: "Legal", links: siteFooterNavLinks.legal },
                ] as const
              ).map((section, sectionIndex) => (
                <div key={section.title}>
                  {sectionIndex > 0 ? <hr className="my-2 border-border" /> : null}
                  <p className="px-2 pt-1 pb-1 text-sm font-semibold text-foreground">
                    {section.title}
                  </p>
                  {section.links.map((link) => (
                    <Link
                      key={`${section.title}-${link.href}`}
                      href={link.href}
                      prefetch={boardsBrowseLinkPrefetch(link.href)}
                      onClick={onMobileDrawerLinkClick}
                      className="cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
