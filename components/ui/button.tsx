import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-smooth ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /* Primary: cerulean, white text, hover pacific, lift -1px */
        default:
          'bg-cerulean text-white hover:bg-pacific hover:-translate-y-px active:translate-y-0',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors',
        /* Secondary: transparent, border cerulean, hover pacific 5% */
        outline:
          'border border-cerulean bg-transparent text-cerulean hover:bg-pacific/5',
        secondary:
          'border border-cerulean bg-transparent text-cerulean hover:bg-pacific/5',
        ghost: 'hover:bg-pacific/5 text-foreground',
        link: 'text-cerulean underline-offset-4 hover:text-pacific hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
