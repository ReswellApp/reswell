"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import type { AddCartItemResult } from "@/app/actions/cart"
import { AddedToCartDialog } from "@/components/features/cart/added-to-cart-dialog"
import {
  shouldOpenAddedToCartDialog,
  type AddedToCartPreview,
} from "@/lib/utils/added-to-cart"

type AddedToCartContextValue = {
  show: (preview: AddedToCartPreview) => void
}

const AddedToCartContext = createContext<AddedToCartContextValue | null>(null)

export function AddedToCartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [preview, setPreview] = useState<AddedToCartPreview | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const show = useCallback((next: AddedToCartPreview) => {
    setPreview(next)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <AddedToCartContext.Provider value={value}>
      {children}
      <AddedToCartDialog preview={preview} open={open} onOpenChange={setOpen} />
    </AddedToCartContext.Provider>
  )
}

export function useOptionalAddedToCart(): AddedToCartContextValue | null {
  return useContext(AddedToCartContext)
}

/** Dispatches the cart badge event and opens the what's-next dialog when the shell is mounted. */
export function useReportAddedToCart() {
  const addedToCart = useOptionalAddedToCart()
  const pathname = usePathname()

  return useCallback(
    (result: AddCartItemResult) => {
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      if (!result.ok || !result.preview || !addedToCart) return
      if (!shouldOpenAddedToCartDialog(pathname)) return
      addedToCart.show(result.preview)
    },
    [addedToCart, pathname],
  )
}
