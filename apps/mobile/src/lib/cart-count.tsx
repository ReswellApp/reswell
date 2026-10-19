import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { AppState } from "react-native"
import { fetchCart } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { subscribeCartChanged } from "@/lib/cart-count-events"

type CartCountValue = {
  count: number
  reload: () => void
}

const CartCountContext = createContext<CartCountValue | null>(null)

/** Header cart count from GET /api/mobile/v1/me/cart, the same cart the website uses. */
export function CartCountProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [count, setCount] = useState(0)

  const reload = useCallback(() => {
    if (!token) {
      setCount(0)
      return
    }
    fetchCart(token)
      .then((cart) => setCount(cart.item_count))
      .catch(() => undefined)
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload()
    })
    return () => subscription.remove()
  }, [reload])

  useEffect(() => subscribeCartChanged(reload), [reload])

  const value = useMemo(() => ({ count, reload }), [count, reload])
  return <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>
}

export function useCartCount(): number {
  return useContext(CartCountContext)?.count ?? 0
}
