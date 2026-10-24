import { usePathname, useRouter } from "expo-router"
import { SearchCartHeader } from "@/components/search-cart-header"
import { useAuth } from "@/lib/auth-context"
import { isSearchHeaderHidden } from "@/lib/search-header-visibility"

type ScreenSearchHeaderProps = {
  showBack?: boolean
  showInbox?: boolean
  insetTop?: boolean
  bordered?: boolean
} & (
  | { mode?: "open" }
  | {
      mode: "input"
      value: string
      onChangeText: (value: string) => void
      onSubmit: () => void
    }
)

/** Search + cart row for browse screens. Hidden automatically on sell, cart, checkout, and chat. */
export function ScreenSearchHeader(props: ScreenSearchHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { session } = useAuth()

  if (isSearchHeaderHidden(pathname)) return null

  const onHome = pathname === "/" || pathname === ""
  const showBack = props.showBack ?? !onHome

  const onCart = () => router.push(session ? "/account/cart" : "/sign-in")
  const onBack = showBack ? () => router.back() : undefined
  const onInbox =
    props.showInbox === true
      ? () => router.push(session ? "/inbox" : "/sign-in")
      : undefined
  const insetTop = props.insetTop
  const bordered = props.bordered

  if (props.mode === "input") {
    return (
      <SearchCartHeader
        mode="input"
        value={props.value}
        onChangeText={props.onChangeText}
        onSubmit={props.onSubmit}
        onBack={onBack}
        onInbox={onInbox}
        onCart={onCart}
        insetTop={insetTop}
        bordered={bordered}
      />
    )
  }

  return (
    <SearchCartHeader
      mode="open"
      onBack={onBack}
      onInbox={onInbox}
      onCart={onCart}
      insetTop={insetTop}
      bordered={bordered}
    />
  )
}
