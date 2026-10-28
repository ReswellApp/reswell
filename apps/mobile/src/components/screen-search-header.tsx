import { usePathname, useRouter } from "expo-router"
import { SearchCartHeader } from "@/components/search-cart-header"
import { useAuthGate } from "@/lib/auth-gate"
import { isSearchHeaderHidden } from "@/lib/search-header-visibility"

type ScreenSearchHeaderProps = {
  showBack?: boolean
  /** Inbox bell beside the cart. Shown unless set to false. */
  showInbox?: boolean
  insetTop?: boolean
  bordered?: boolean
  /** Overrides the default back navigation (for in-screen steps). */
  onBack?: () => void
} & (
  | { mode?: "open" }
  | {
      mode: "input"
      value: string
      onChangeText: (value: string) => void
      onSubmit: () => void
    }
)

/** Search, inbox, and cart row. Hidden on sell. */
export function ScreenSearchHeader(props: ScreenSearchHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { requestAuth } = useAuthGate()

  if (isSearchHeaderHidden(pathname)) return null

  const onHome = pathname === "/" || pathname === ""
  const showBack = props.showBack ?? !onHome

  const onCart = () => requestAuth(() => router.push("/account/cart"))
  const onBack = showBack ? (props.onBack ?? (() => router.back())) : undefined
  const onInbox =
    props.showInbox === false
      ? undefined
      : () => requestAuth(() => router.push("/inbox"))
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
