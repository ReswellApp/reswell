"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Fragment,
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
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  X,
  Menu,
  Search,
  MessageSquare,
  User,
  LogOut,
  Package,
  Heart,
  Settings,
  LayoutDashboard,
  Banknote,
  Clock,
  ChevronDown,
  ShoppingCart,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { HeaderNavSearch } from "@/components/header-nav-search"
import { reconcileWalletAggregates } from "@/lib/wallet-reconcile"
import { clearNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import { allCategoriesForNav, headerCategoriesDropdownSections } from "@/lib/site-category-directory"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { headerDisplayName, headerInitialFromDisplayName } from "@/lib/header-user-display"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { CartHeaderLink } from "@/components/cart-header-link"
import type { User as SupabaseUser } from "@supabase/supabase-js"

type ProfileAvatarFields = {
  avatar_url: string | null
  shop_logo_url: string | null
  is_shop: boolean | null
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

/** Desktop + mobile primary nav (Apparel / Leashes / Vintage last before Categories dropdown). */
const navigation = [
  { name: "Surfboards", href: "/boards" },
  { name: "Fins", href: "/fins" },
  { name: "Surfpacks & Bags", href: "/backpacks" },
  { name: "Board Bags", href: "/board-bags" },
  { name: "Wetsuits", href: "/wetsuits" },
  { name: "Apparel & Lifestyle", href: "/apparel-lifestyle" },
  { name: "Leashes", href: "/leashes" },
  { name: "Vintage", href: "/collectibles-vintage" },
]

/** Right-aligned nav in the category bar, visually separated from marketplace categories. */
const secondaryNav = [
  { name: "Sellers", href: "/sellers" },
  { name: "Brands", href: BRANDS_BASE },
  { name: "Board Talk", href: "/board-talk" },
]

function navItemIsActive(pathname: string | null, searchParams: URLSearchParams, href: string): boolean {
  if (!pathname) return false
  const q = href.indexOf("?")
  const path = q === -1 ? href : href.slice(0, q)
  const query = q === -1 ? null : href.slice(q + 1)

  if (!pathname.startsWith(path)) return false

  if (!query) {
    if (path === "/gear") {
      if (pathname !== "/gear") return false
      const cat = searchParams.get("category")
      return !cat || cat === "all"
    }
    if (path === "/boards") {
      return (
        (pathname === path && !searchParams.get("type")) || pathname.startsWith(`${path}/`)
      )
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const required = new URLSearchParams(query)
  for (const key of new Set(required.keys())) {
    if (searchParams.get(key) !== required.get(key)) return false
  }
  return pathname === path || (path === "/gear" && pathname.startsWith("/gear"))
}

const mainNavHrefs = new Set(navigation.map((item) => item.href))
const dropdownCategories = allCategoriesForNav.filter((cat) => !mainNavHrefs.has(cat.href))

/** Header Categories dropdown: grey heading + links only (no bold title / view-all row). */
const headerDropdownCompactSectionIds = new Set(["surfboards", "fins", "surfpacks"])

const CATEGORY_BAR_GAP_PX = 32

function computeVisibleNavCount(availableWidth: number, linkWidths: number[], categoriesWidth: number): number {
  for (let n = linkWidths.length; n >= 0; n--) {
    const sumLinks = linkWidths.slice(0, n).reduce((a, b) => a + b, 0)
    const total = sumLinks + categoriesWidth + n * CATEGORY_BAR_GAP_PX
    if (total <= availableWidth) return n
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
  const [visibleCount, setVisibleCount] = useState(navigation.length)

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
    const catEl = measure.querySelector<HTMLElement>("[data-nav-measure='categories']")
    const linkWidths = Array.from(linkEls).map((el) => el.getBoundingClientRect().width)
    const catW = Math.max(catEl?.getBoundingClientRect().width ?? 96, 1)

    // Before fonts / first paint, widths can be 0 — don't collapse the bar to 0 visible links.
    if (!widthsLookReady(linkWidths)) {
      return
    }

    let next = computeVisibleNavCount(available, linkWidths, catW)
    // Wide desktop slot but algorithm returned 0 → measurement/layout glitch, not a real phone-width bar.
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

  const visibleNav = navigation.slice(0, visibleCount)
  const overflowNav = navigation.slice(visibleCount)

  return (
    <div className="relative hidden border-t border-lightgray/40 md:block">
      <div
        ref={measureRef}
        className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] flex items-center gap-8 whitespace-nowrap opacity-0"
        aria-hidden
      >
        {navigation.map((item) => (
          <span key={item.href} data-nav-measure="link" className="shrink-0 py-4 text-[15px]">
            {item.name}
          </span>
        ))}
        <span data-nav-measure="categories" className="flex shrink-0 items-center gap-1 py-4 text-[15px]">
          Categories
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </span>
      </div>

      <div className="container mx-auto flex min-w-0 items-stretch">
        <div ref={leftSlotRef} className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={boardsBrowseLinkPrefetch(item.href)}
              className={`cat-link shrink-0 py-4 text-[15px] transition-colors duration-smooth ${
                navItemIsActive(pathname, headerSearchParams, item.href) ? "font-medium" : ""
              }`}
            >
              {item.name}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="cat-link flex shrink-0 items-center gap-1 py-4 text-[15px] transition-colors duration-smooth focus:outline-none">
              Categories
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[min(70vh,28rem)] w-56 overflow-y-auto [&_a]:!text-[#6E6E6E] [&_a:hover]:!text-[#000000] [&_a[data-highlighted]]:!text-[#000000] [&_a:focus]:!text-[#000000]"
            >
              {overflowNav.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} prefetch={boardsBrowseLinkPrefetch(item.href)} className="w-full">
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              {overflowNav.length > 0 ? <DropdownMenuSeparator /> : null}
              {headerCategoriesDropdownSections.map((section, idx) => (
                <Fragment key={section.id}>
                  {idx > 0 ? <DropdownMenuSeparator /> : null}
                  {!headerDropdownCompactSectionIds.has(section.id) ? (
                    <>
                      <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold text-foreground">
                        {section.title}
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link
                          href={section.browseAllHref}
                          prefetch={boardsBrowseLinkPrefetch(section.browseAllHref)}
                          className="w-full font-medium"
                        >
                          {section.browseAllLabel}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {section.subcategories.map((group) => (
                    <Fragment key={`${section.id}-${group.heading}`}>
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        {group.heading}
                      </DropdownMenuLabel>
                      {group.links.map((link) => (
                        <DropdownMenuItem key={`${link.href}-${link.label}`} asChild>
                          <Link href={link.href} prefetch={boardsBrowseLinkPrefetch(link.href)} className="w-full">
                            {link.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              <DropdownMenuSeparator />
              {dropdownCategories.map((cat) => (
                <DropdownMenuItem key={cat.label} asChild>
                  <Link href={cat.href} prefetch={boardsBrowseLinkPrefetch(cat.href)} className="w-full">
                    {cat.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/categories" className="w-full font-medium">
                  See all categories
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav
          className="ml-6 flex shrink-0 items-center gap-8 border-l border-lightgray/60 pl-8"
          aria-label="Editorial and community"
        >
          {secondaryNav.map((item) => {
            const active = pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`cat-link py-4 text-[15px] transition-colors duration-smooth ${
                  active ? "font-medium" : ""
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileLogoHovered, setMobileLogoHovered] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // CLS-FIX: track when auth check has resolved so we can reserve the
  // correct amount of space for auth-dependent action buttons before they
  // appear, preventing the search bar from shifting horizontally.
  const [authLoaded, setAuthLoaded] = useState(false)
  /** When the image URL is set but fails to load (403, blocked, bad URL), hide img so fallback letter shows. */
  const [avatarImageFailed, setAvatarImageFailed] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const headerSearchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const { openLogin, openSignUp } = useAuthModal()

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
    async function loadHeaderAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin, avatar_url, display_name, shop_logo_url, is_shop")
            .eq("id", user.id)
            .single()
          setIsAdmin(profile?.is_admin || false)
          setProfileAvatarUrl(resolveHeaderAvatarUrl(user, profile))
          setProfileDisplayName(profile?.display_name || null)

          const { data: unreadMsgCount } = await supabase.rpc("get_unread_message_count", { uid: user.id })
          setUnreadMessages(Number(unreadMsgCount ?? 0))

          const { data: wallet } = await supabase
            .from("wallets")
            .select("balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
            .eq("user_id", user.id)
            .single()
          setWalletBalance(wallet ? reconcileWalletAggregates(wallet).balance : 0)
        } else {
          setIsAdmin(false)
          setProfileAvatarUrl(null)
          setProfileDisplayName(null)
          setUnreadMessages(0)
          setWalletBalance(null)
        }
      } finally {
        // Always resolve auth so the header never stays on the loading skeleton forever
        // if profile/wallet/RPC throws.
        setAuthLoaded(true)
      }
    }

    void loadHeaderAuth()

    function onHeaderAuthRefresh() {
      void loadHeaderAuth()
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
    } = supabase.auth.onAuthStateChange(() => {
      void loadHeaderAuth()
    })

    return () => {
      window.removeEventListener(HEADER_AUTH_REFRESH_EVENT, onHeaderAuthRefresh)
      window.removeEventListener("unreadCountRefresh", refreshUnreadCount)
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (mobileMenuOpen && mobileSearchRef.current) {
      mobileSearchRef.current.value = ""
    }
  }, [mobileMenuOpen])

  /**
   * Close the drawer after Next `<Link>` runs its own navigation (`linkClicked`).
   * We must not `preventDefault` here — that skips Link's handler. Defer closing so the drawer
   * stays mounted until navigation has started.
   */
  const onMobileDrawerLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    queueMicrotask(() => setMobileMenuOpen(false))
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = "/"
  }

  return (
    <>
      <style>{`
        .cat-link { color: #6E6E6E !important; text-decoration: none !important; }
        .cat-link:hover { color: #000000 !important; text-decoration: none !important; }
      `}</style>
      {/* CLS-FIX: explicit min-h locks the header row height before fonts and
          auth state resolve, so content below never shifts vertically. */}
      <header className="relative z-50 w-full border-b border-lightgray bg-white backdrop-blur supports-[backdrop-filter]:bg-white/95 transition-colors duration-smooth">
        <div className="container mx-auto flex min-w-0 items-center gap-2 py-2 sm:py-2.5 md:py-3 md:gap-4 min-h-[56px] sm:min-h-[64px] md:min-h-[80px]">
          {/* Logo + home link; padding keeps white breathing room around the mark */}
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-md px-2 py-1 no-underline hover:no-underline sm:px-2 sm:py-1.5"
          >
            <span
              className="text-3xl font-black tracking-tight text-black sm:text-4xl md:text-5xl"
              style={{ fontFamily: '"Alfran 2", Arial, sans-serif', fontWeight: 800 }}
            >
              Reswell
            </span>
          </Link>

          {/* Main search (md+): fills space between nav and actions */}
          <Suspense
            fallback={<div className="hidden min-w-0 flex-1 md:block" aria-hidden />}
          >
            <HeaderNavSearch />
          </Suspense>

          {/* CLS-FIX: actions area keeps a stable minimum width while auth loads.
              The invisible placeholder reserves space equal to the logged-in
              desktop layout so the search bar never shifts horizontally. */}
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5 md:gap-0.5 text-black">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex h-10 w-10 text-black hover:bg-pacific/5 md:hidden"
                  aria-label="Search"
                >
                  <Search className="h-[22px] w-[22px]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[min(100vw-2rem,380px)] rounded-2xl border-border bg-card p-4 shadow-sm"
                align="end"
                sideOffset={8}
              >
                <form
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
                    router.push(`/search?q=${encodeURIComponent(q)}`)
                    setSearchQuery("")
                    clearNavSearchQuery()
                    setSearchOpen(false)
                  }}
                  className="flex gap-3"
                >
                  <div className="relative min-w-0 flex-1">
                    <SearchInputWithSuggest
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSelect={(text) => {
                        router.push(`/search?q=${encodeURIComponent(text)}`)
                        setSearchQuery("")
                        clearNavSearchQuery()
                        setSearchOpen(false)
                      }}
                      onNavigate={() => {
                        setSearchQuery("")
                        clearNavSearchQuery()
                        setSearchOpen(false)
                      }}
                      placeholder="Search boards, gear, wetsuits…"
                      section=""
                      listboxId="nav-search-suggestions-tablet"
                      leftIcon={<Search className="h-4 w-4 text-muted-foreground" />}
                      inputClassName="h-10 rounded-xl border-border bg-background text-foreground"
                      className="w-full"
                      autoFocus={searchOpen}
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-10 shrink-0 rounded-xl px-4">
                    Search
                  </Button>
                </form>
              </PopoverContent>
            </Popover>

            <Button
              asChild
              size="sm"
              className="hidden h-10 shrink-0 rounded-xl px-4 sm:inline-flex"
            >
              <Link href="/sell">Sell your Board</Link>
            </Button>

            <Link href="/feed">
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex h-11 w-11 text-black hover:bg-pacific/5"
                aria-label="Feed — new listings and recently sold"
              >
                <Clock className="h-6 w-6" />
              </Button>
            </Link>

            <Link
              href={user ? "/favorites" : `/auth/login?redirect=${encodeURIComponent("/favorites")}`}
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
              <Button variant="ghost" size="icon" className="h-11 w-11 text-black hover:bg-pacific/5">
                <Heart className="h-6 w-6" />
                <span className="sr-only">Favorites</span>
              </Button>
            </Link>

            {/* CLS-FIX: invisible placeholder ghost buttons reserve the same horizontal
                space as the logged-in action cluster while the auth check is in-flight.
                This prevents the search bar from shifting once the real buttons appear. */}
            {!authLoaded && (
              <div className="hidden sm:flex items-center gap-1 md:gap-0.5 pointer-events-none select-none" aria-hidden>
                <div className="h-11 w-11 rounded-full" />
                <div className="h-11 w-11 rounded-full" />
              </div>
            )}

            {authLoaded && user ? (
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-0.5">
                <CartHeaderLink />
                <Link href="/messages" className="relative hidden sm:inline-flex">
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-black hover:bg-pacific/5">
                    <MessageSquare className="h-6 w-6" />
                    {unreadMessages > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-full px-1 text-xs flex items-center justify-center bg-red-500 text-white hover:bg-red-600"
                      >
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </Badge>
                    )}
                    <span className="sr-only">Messages</span>
                  </Button>
                </Link>

                <div className="ml-2 shrink-0 sm:ml-3 md:ml-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-black hover:bg-pacific/5">
                      <Avatar className="h-9 w-9">
                        {profileAvatarUrl && !avatarImageFailed ? (
                          <AvatarImage
                            src={profileAvatarUrl}
                            alt="Profile"
                            onLoadingStatusChange={(status) => {
                              if (status === "error") setAvatarImageFailed(true)
                            }}
                          />
                        ) : null}
                        <AvatarFallback className="text-foreground">{resolvedInitial}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center gap-3 px-2 py-2">
                      <Avatar className="h-10 w-10 shrink-0 border border-border">
                        {profileAvatarUrl && !avatarImageFailed ? (
                          <AvatarImage
                            src={profileAvatarUrl}
                            alt=""
                            onLoadingStatusChange={(status) => {
                              if (status === "error") setAvatarImageFailed(true)
                            }}
                          />
                        ) : null}
                        <AvatarFallback className="text-sm text-foreground">{resolvedInitial}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {resolvedDisplayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/earnings" className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Banknote className="mr-2 h-4 w-4" />
                          Earnings
                        </span>
                        {walletBalance !== null && (
                          <span className="text-xs font-medium text-black dark:text-white ml-2 tabular-nums">
                            ${walletBalance.toFixed(2)}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/listings" className="flex items-center">
                        <Package className="mr-2 h-4 w-4" />
                        My Listings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="flex items-center text-foreground">
                            <User className="mr-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-foreground">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            ) : authLoaded ? (
              <div className="flex items-center gap-0">
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
                <Link
                  href="/auth/sign-up"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                    e.preventDefault()
                    openSignUp()
                  }}
                  className="hidden sm:flex text-[15px] font-medium text-cerulean hover:text-cerulean/90 transition-colors px-3 py-2"
                >
                  Sign up
                </Link>
              </div>
            ) : null}

            {/* Mobile menu toggle: two-line hamburger when closed, X when open */}
            <button
              type="button"
              className={`md:hidden flex h-10 w-10 min-w-[2.5rem] items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                mobileLogoHovered && !mobileMenuOpen
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-border bg-white text-black"
              }`}
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
        </div>

        <HeaderDesktopCategoryBar pathname={pathname} headerSearchParams={headerSearchParams} />
      </header>

      {/* Mobile slide-out menu (pure CSS, no Radix Dialog) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-[min(400px,100vw)] max-w-full bg-background border-l shadow-xl p-4 sm:p-6 overflow-y-auto overflow-x-hidden animate-in slide-in-from-right duration-300 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-top:max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-semibold text-foreground">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            {user && authLoaded && (
              <Link
                href="/dashboard"
                onClick={onMobileDrawerLinkClick}
                className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 no-underline transition-colors hover:bg-muted/50"
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
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={boardsBrowseLinkPrefetch(item.href)}
                  onClick={onMobileDrawerLinkClick}
                  className="cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
                >
                  {item.name}
                </Link>
              ))}
              {dropdownCategories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={onMobileDrawerLinkClick}
                  className="cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
                >
                  {cat.label}
                </Link>
              ))}
              <Link
                href="/categories"
                onClick={onMobileDrawerLinkClick}
                className="cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
              >
                See all categories
              </Link>
              <hr className="my-2 border-border" />
              {secondaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileDrawerLinkClick}
                  className="cat-link py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
                >
                  {item.name}
                </Link>
              ))}
              <Button
                asChild
                size="sm"
                className="h-10 w-full shrink-0 justify-center rounded-xl px-4"
              >
                <Link href="/sell" onClick={onMobileDrawerLinkClick}>
                  Sell your Board
                </Link>
              </Button>
              <Link
                href="/feed"
                onClick={onMobileDrawerLinkClick}
                className="flex items-center gap-2 py-3 px-2 text-lg font-medium text-foreground hover:text-cerulean hover:bg-muted/50 rounded-lg transition-colors min-h-touch"
              >
                <Clock className="h-5 w-5 shrink-0" />
                Feed
              </Link>
              <Link
                href="/cart"
                onClick={onMobileDrawerLinkClick}
                className="flex items-center gap-2 py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg min-h-touch"
              >
                <ShoppingCart className="h-5 w-5 shrink-0" />
                Cart
              </Link>
              <hr className="my-2 border-border" />
              <div className="flex min-w-0 gap-2">
                <Input
                  ref={mobileSearchRef}
                  type="search"
                  placeholder="Search boards, gear, wetsuits…"
                  className="min-w-0 flex-1 rounded-lg border-border min-h-touch"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const q = (e.currentTarget.value || "").trim()
                      if (!q) {
                        clearNavSearchQuery()
                        setMobileMenuOpen(false)
                        await goToCuratedSearchPage(router, pathname, headerSearchParams.toString())
                        return
                      }
                      router.push(`/search?q=${encodeURIComponent(q)}`)
                      e.currentTarget.value = ""
                      clearNavSearchQuery()
                      setMobileMenuOpen(false)
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg min-h-touch shrink-0"
                  onClick={async () => {
                    const input = mobileSearchRef.current
                    const q = (input?.value || "").trim()
                    if (!q) {
                      clearNavSearchQuery()
                      setMobileMenuOpen(false)
                      await goToCuratedSearchPage(router, pathname, headerSearchParams.toString())
                      return
                    }
                    router.push(`/search?q=${encodeURIComponent(q)}`)
                    if (input) input.value = ""
                    clearNavSearchQuery()
                    setMobileMenuOpen(false)
                  }}
                >
                  Search
                </Button>
              </div>
              <Link
                href={user ? "/favorites" : "/auth/login?redirect=" + encodeURIComponent("/favorites")}
                onClick={
                  user
                    ? onMobileDrawerLinkClick
                    : (e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                        e.preventDefault()
                        openLogin("/favorites")
                        queueMicrotask(() => setMobileMenuOpen(false))
                      }
                }
                className="flex items-center gap-2 py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg min-h-touch"
              >
                <Heart className="h-5 w-5 shrink-0" />
                Favorites
              </Link>
              {!user && (
                <>
                  <Link
                    href="/auth/login"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      openLogin()
                      queueMicrotask(() => setMobileMenuOpen(false))
                    }}
                    className="py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg min-h-touch block"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                      e.preventDefault()
                      openSignUp()
                      queueMicrotask(() => setMobileMenuOpen(false))
                    }}
                    className="py-3 px-2 text-lg font-medium text-cerulean hover:bg-muted/50 rounded-lg min-h-touch block"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
