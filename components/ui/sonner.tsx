'use client'

import { AlertCircle, Check, Info, Loader2, XCircle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ style, ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      /* System-style pill: mostly errors; neutral chrome; no celebratory success treatment. */
      position="top-center"
      gap={6}
      duration={3800}
      visibleToasts={1}
      pauseWhenPageIsHidden
      swipeDirections={['top', 'left', 'right']}
      offset={{
        top: 'max(0.625rem, env(safe-area-inset-top, 0px))',
      }}
      style={
        {
          '--width': 'min(288px, calc(100vw - 1.25rem))',
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:gap-2 ' +
            'group-[.toaster]:rounded-full group-[.toaster]:border group-[.toaster]:border-border/35 ' +
            'group-[.toaster]:bg-background/92 group-[.toaster]:text-foreground ' +
            'group-[.toaster]:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] ' +
            'dark:group-[.toaster]:shadow-[0_2px_20px_-4px_rgba(0,0,0,0.45)] ' +
            'group-[.toaster]:backdrop-blur-2xl group-[.toaster]:backdrop-saturate-150 ' +
            'group-[.toaster]:px-4 group-[.toaster]:py-2 ' +
            'group-[.toaster]:text-[13px] group-[.toaster]:font-normal group-[.toaster]:leading-snug ' +
            'group-[.toaster]:ring-1 group-[.toaster]:ring-black/[0.03] dark:group-[.toaster]:ring-white/[0.05]',
          description:
            'group-[.toast]:text-muted-foreground group-[.toast]:text-[12px] group-[.toast]:font-normal group-[.toast]:leading-relaxed',
          actionButton:
            'group-[.toast]:rounded-full group-[.toast]:bg-foreground group-[.toast]:px-3 ' +
            'group-[.toast]:py-1.5 group-[.toast]:text-[11px] group-[.toast]:font-semibold ' +
            'group-[.toast]:text-background group-[.toast]:shadow-sm',
          cancelButton:
            'group-[.toast]:rounded-full group-[.toast]:bg-muted/85 group-[.toast]:px-3 ' +
            'group-[.toast]:py-1.5 group-[.toast]:text-[11px] group-[.toast]:font-medium ' +
            'group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:!border-border/40 group-[.toast]:!bg-background/90 ' +
            'group-[.toast]:!h-[18px] group-[.toast]:!w-[18px] group-[.toast]:opacity-60 hover:group-[.toast]:!opacity-100',
          icon: 'group-[.toast]:!ml-0 group-[.toast]:!mr-0',
        },
      }}
      icons={{
        success: (
          <Check
            className="size-[15px] shrink-0 text-foreground/75 dark:text-foreground/80"
            strokeWidth={2.25}
            aria-hidden
          />
        ),
        info: (
          <Info
            className="size-[15px] shrink-0 text-foreground/55 dark:text-foreground/60"
            strokeWidth={2}
            aria-hidden
          />
        ),
        warning: (
          <AlertCircle
            className="size-[15px] shrink-0 text-amber-600 dark:text-amber-400"
            strokeWidth={2}
            aria-hidden
          />
        ),
        error: (
          <XCircle
            className="size-[15px] shrink-0 text-red-600 dark:text-red-400"
            strokeWidth={2}
            aria-hidden
          />
        ),
        loading: (
          <Loader2
            className="size-[15px] shrink-0 animate-spin text-muted-foreground"
            strokeWidth={2}
            aria-hidden
          />
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }
