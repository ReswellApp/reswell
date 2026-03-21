"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  X,
  Search,
  ShoppingCart,
  MessageSquare,
  User,
  LogOut,
  Package,
  Heart,
  Settings,
  LayoutDashboard,
  Wallet,
  Clock,
  ChevronDown,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { HeaderNavSearch } from "@/components/header-nav-search"
import { clearNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const navigation = [
  { name: "Used Gear", href: "/used" },
  { name: "New Gear", href: "/shop" },
  { name: "Surfboards", href: "/boards" },
]

const allCategories = [
  { name: "Surfboards", href: "/boards" },
  { name: "Wetsuits", href: "/used?category=wetsuits" },
  { name: "Fins", href: "/used?category=fins" },
  { name: "Leashes", href: "/used?category=leashes" },
  { name: "Traction Pads", href: "/used?category=traction-pads-used" },
  { name: "Board Bags", href: "/used?category=board-bags" },
  { name: "Backpacks", href: "/used?category=backpacks" },
  { name: "Apparel & Lifestyle", href: "/used?category=apparel-lifestyle" },
  { name: "Collectibles & Vintage", href: "/used?category=collectibles-vintage" },
]

export function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileLogoHovered, setMobileLogoHovered] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const headerSearchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("")
      clearNavSearchQuery()
    }
  }, [searchOpen])

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, avatar_url, display_name")
          .eq("id", user.id)
          .single()
        setIsAdmin(profile?.is_admin || false)
        setProfileAvatarUrl(profile?.avatar_url || null)
        setProfileDisplayName(profile?.display_name || null)

        const cart = JSON.parse(localStorage.getItem("cart") || "[]")
        setCartCount(cart.reduce((sum: number, i: { quantity?: number }) => sum + (i.quantity ?? 1), 0))

        const { data: unreadMsgCount } = await supabase.rpc("get_unread_message_count", { uid: user.id })
        const { count: unreadNotifCount } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false)
        setUnreadMessages(Number(unreadMsgCount ?? 0) + (unreadNotifCount ?? 0))

        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .single()
        setWalletBalance(wallet ? parseFloat(wallet.balance) : 0)
      }
    }

    getUser()

    async function refreshUnreadCount() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) return
      const { data: unreadMsgCount } = await supabase.rpc("get_unread_message_count", { uid: u.id })
      const { count: unreadNotifCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", u.id)
        .eq("is_read", false)
      setUnreadMessages(Number(unreadMsgCount ?? 0) + (unreadNotifCount ?? 0))
    }
    window.addEventListener("unreadCountRefresh", refreshUnreadCount)

    function updateCartCount() {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]")
      setCartCount(cart.reduce((sum: number, i: { quantity?: number }) => sum + (i.quantity ?? 1), 0))
    }
    window.addEventListener("cartUpdated", updateCartCount)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      window.removeEventListener("unreadCountRefresh", refreshUnreadCount)
      window.removeEventListener("cartUpdated", updateCartCount)
      subscription.unsubscribe()
    }
  }, [supabase, pathname])

  useEffect(() => {
    if (mobileMenuOpen && mobileSearchRef.current) {
      mobileSearchRef.current.value = ""
    }
  }, [mobileMenuOpen])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = "/"
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-lightgray bg-white backdrop-blur supports-[backdrop-filter]:bg-white/95 transition-colors duration-smooth pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex h-14 sm:h-16 md:h-20 min-w-0 items-center gap-2 md:gap-4">
          {/* Logo + home link (desktop: logo left of name; mobile: logo is in menu toggle) */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cerulean text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M2 19c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M2 5c.6.5 1.2 1 2.5 1C7 6 7 4 9.5 4c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              </svg>
            </div>
            <span
              className="text-2xl font-bold text-black whitespace-nowrap"
              style={{ overflow: "visible", textOverflow: "clip" }}
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

          {/* Actions */}
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
                      placeholder="Search gear, boards, wetsuits..."
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

            <Link href="/used/recent">
              <Button variant="ghost" size="icon" className="hidden sm:flex h-11 w-11 text-black hover:bg-pacific/5" aria-label="Recently added used items">
                <Clock className="h-6 w-6" />
              </Button>
            </Link>

            <Link href={user ? "/saved" : `/auth/login?redirect=${encodeURIComponent("/saved")}`}>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-black hover:bg-pacific/5">
                <Heart className="h-6 w-6" />
                <span className="sr-only">Saved</span>
              </Button>
            </Link>

            {user ? (
              <>
                <Link href="/messages" className="relative">
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-black hover:bg-pacific/5">
                    <MessageSquare className="h-6 w-6" />
                    <Badge
                      variant={unreadMessages > 0 ? "destructive" : "secondary"}
                      className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-full px-1 text-xs flex items-center justify-center"
                    >
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </Badge>
                    <span className="sr-only">Messages</span>
                  </Button>
                </Link>

                <Link href="/shop/cart" className="relative">
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-black hover:bg-pacific/5">
                    <ShoppingCart className="h-6 w-6" />
                    {cartCount > 0 && (
                      <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center bg-cerulean text-white">
                        {cartCount > 9 ? "9+" : cartCount}
                      </Badge>
                    )}
                    <span className="sr-only">Cart</span>
                  </Button>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-black hover:bg-pacific/5">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={profileAvatarUrl || user.user_metadata?.avatar_url || "/placeholder.svg"} alt="Profile" />
                        <AvatarFallback>
                        {(profileDisplayName || user.user_metadata?.full_name || "User").charAt(0).toUpperCase()}
                      </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">
                        {profileDisplayName || user.user_metadata?.full_name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/wallet" className="flex items-center justify-between">
                        <span className="flex items-center">
                          <Wallet className="mr-2 h-4 w-4" />
                          Reswell Bucks
                        </span>
                        {walletBalance !== null && (
                          <span className="text-xs font-medium text-cerulean ml-2">
                            R${walletBalance.toFixed(2)}
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
                      <Link href="/dashboard/favorites" className="flex items-center">
                        <Heart className="mr-2 h-4 w-4" />
                        Favorites
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
                          <Link href="/admin" className="flex items-center text-cerulean">
                            <User className="mr-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link href="/sell" className="hidden sm:flex text-[15px] font-medium text-foreground/80 hover:text-cerulean transition-colors px-2">
                  Sell
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Link href="/auth/login" className="hidden sm:flex text-[15px] font-medium text-foreground/80 hover:text-cerulean transition-colors px-3 py-2">
                  Log in
                </Link>
              </div>
            )}

            {/* Mobile menu toggle: logo when closed (white + black waves, hover blue + white waves), X when open */}
            <button
              type="button"
              className={`md:hidden flex h-9 w-9 min-w-[2.25rem] items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                mobileLogoHovered && !mobileMenuOpen
                  ? "border-cerulean bg-cerulean text-white"
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 pointer-events-none"
                >
                  <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                  <path d="M2 19c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                  <path d="M2 5c.6.5 1.2 1 2.5 1C7 6 7 4 9.5 4c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Categories bar (desktop) */}
        <div className="hidden md:flex container mx-auto items-center gap-8 border-t border-lightgray/40">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`py-4 text-[15px] transition-colors duration-smooth hover:text-cerulean ${
                pathname?.startsWith(item.href)
                  ? "text-cerulean font-medium"
                  : "text-foreground/70"
              }`}
            >
              {item.name}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 py-4 text-[15px] text-foreground/70 transition-colors duration-smooth hover:text-cerulean focus:outline-none">
              Categories
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {allCategories.map((cat) => (
                <DropdownMenuItem key={cat.name} asChild>
                  <Link href={cat.href} className="w-full">
                    {cat.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-semibold text-foreground">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-2 text-lg font-medium text-foreground hover:text-cerulean hover:bg-muted/50 rounded-lg transition-colors min-h-touch flex items-center"
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/used/recent"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-2 text-lg font-medium text-foreground hover:text-cerulean hover:bg-muted/50 rounded-lg transition-colors min-h-touch"
              >
                <Clock className="h-5 w-5 shrink-0" />
                Recently added
              </Link>
              <hr className="my-2 border-border" />
              <div className="flex min-w-0 gap-2">
                <Input
                  ref={mobileSearchRef}
                  type="search"
                  placeholder="Search..."
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
                href={user ? "/saved" : "/auth/login?redirect=" + encodeURIComponent("/saved")}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg min-h-touch"
              >
                <Heart className="h-5 w-5 shrink-0" />
                Saved
              </Link>
              {user && (
                <Link
                  href="/sell"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-3 px-2 text-lg font-medium text-cerulean hover:bg-muted/50 rounded-lg min-h-touch"
                >
                  Sell Your Gear
                </Link>
              )}
              {!user && (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-3 px-2 text-lg font-medium hover:bg-muted/50 rounded-lg min-h-touch block"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    onClick={() => setMobileMenuOpen(false)}
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
