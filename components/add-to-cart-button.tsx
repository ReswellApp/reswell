"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ShoppingCart, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CartItem {
  id: string
  name: string
  price: number
  image_url: string | null
  quantity: number
}

interface AddToCartButtonProps {
  item: {
    id: string
    name: string
    price: number
    image_url: string | null
    stock_quantity: number
  }
  quantity?: number
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function AddToCartButton({
  item,
  quantity = 1,
  variant = "default",
  size = "default",
  className,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)

  function addToCart() {
    setLoading(true)

    try {
      // Get current cart from localStorage
      const cart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]")
      
      // Check if item already in cart
      const existingIndex = cart.findIndex((i) => i.id === item.id)
      
      if (existingIndex >= 0) {
        // Update quantity
        const newQuantity = cart[existingIndex].quantity + quantity
        if (newQuantity > item.stock_quantity) {
          toast.error("Not enough stock available")
          return
        }
        cart[existingIndex].quantity = newQuantity
      } else {
        // Add new item
        cart.push({
          id: item.id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          quantity,
        })
      }

      // Save to localStorage
      localStorage.setItem("cart", JSON.stringify(cart))

      // Dispatch custom event to update header cart count
      window.dispatchEvent(new CustomEvent("cartUpdated"))

      setAdded(true)
      toast.success("Added to cart")

      // Reset added state after 2 seconds
      setTimeout(() => setAdded(false), 2000)
    } catch {
      toast.error("Failed to add to cart")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={addToCart}
      disabled={loading || item.stock_quantity <= 0}
      className={cn(
        "transition-all",
        added && "bg-green-600 hover:bg-green-700 text-white",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : added ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Added
        </>
      ) : item.stock_quantity <= 0 ? (
        "Out of Stock"
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </>
      )}
    </Button>
  )
}
