import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx,css}',
    // Shared `cn(...)` class strings in lib (listing cards, homepage scroll) must be scanned
    // or fixed widths like `sm:w-52` are omitted and tiles/images blow up to intrinsic size.
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        headline: ['var(--font-headline)', 'var(--font-sans)', 'sans-serif'],
        /** Technical strings use the same Stack Sans Text cut (no monospace). */
        mono: ['var(--font-sans)', 'sans-serif'],
      },
      container: {
        center: true,
        padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem' },
        screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1400px' },
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      colors: {
        /* Slate-neutral professional palette */
        white: '#FFFFFF',
        black: '#04070E',
        midgray: '#64748B',
        lightgray: '#E2E8F0',
        /* Legacy names → mapped to slate scale */
        cerulean: '#04070E',
        pacific: '#334155',
        olive: '#64748B',
        gold: '#94A3B8',
        background: '#FFFFFF',
        foreground: '#04070E',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#04070E',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#04070E',
        },
        primary: {
          DEFAULT: '#04070E',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: 'transparent',
          foreground: '#04070E',
        },
        muted: {
          DEFAULT: '#F8FAFC',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#334155',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        /** Listing tile favorite heart (hover + saved) — card overlay only uses heartIcon (#04070E) */
        listingHeart: '#355185',
        /** Listing grid/card favorite control (distinct from PDP red) */
        heartIcon: '#04070E',
        /** Footer “Made with ♥” icon */
        footerHeart: '#F9F9F2',
        border: '#E2E8F0',
        input: '#CBD5E1',
        ring: '#04070E',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      transitionDuration: {
        smooth: '250ms',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(4 7 14 / 0.05)',
        'soft-hover': '0 10px 15px -3px rgb(4 7 14 / 0.08), 0 4px 6px -4px rgb(4 7 14 / 0.05)',
        surface: '0 1px 3px 0 rgb(4 7 14 / 0.06), 0 1px 2px -1px rgb(4 7 14 / 0.06)',
        'surface-lg': '0 20px 25px -5px rgb(4 7 14 / 0.08), 0 8px 10px -6px rgb(4 7 14 / 0.05)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'review-stars-pop': {
          '0%': { transform: 'scale(0.72)', opacity: '0.5', filter: 'brightness(0.92)' },
          '55%': { transform: 'scale(1.1)', opacity: '1', filter: 'brightness(1.12)' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'brightness(1)' },
        },
        'marquee-x': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'review-stars-pop': 'review-stars-pop 0.55s ease-out both',
        'marquee-x': 'marquee-x var(--marquee-duration, 40s) linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
