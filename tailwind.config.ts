import type { Config } from 'tailwindcss'
import { mortdashTheme } from './.cursor/design-system/tailwind-theme.extend.js'

export default {
  theme: {
    extend: {
      ...mortdashTheme,
      keyframes: {
        'flyer-float-left': {
          '0%, 100%': { transform: 'translateY(0) rotate(-10deg)' },
          '50%': { transform: 'translateY(-8px) rotate(-7deg)' }
        },
        'flyer-float-right': {
          '0%, 100%': { transform: 'translateY(0) rotate(9deg)' },
          '50%': { transform: 'translateY(-10px) rotate(6deg)' }
        },
        'flyer-float-front': {
          '0%, 100%': { transform: 'translate(-50%, 0) scale(1)' },
          '50%': { transform: 'translate(-50%, -7px) scale(1.03)' }
        },
        'flyer-shimmer': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' }
        },
        'flyer-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%': { transform: 'translateY(-5px)', opacity: '1' }
        },
        'flyer-hint-fade': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'flyer-float-left': 'flyer-float-left 2.2s ease-in-out infinite',
        'flyer-float-right': 'flyer-float-right 2.2s ease-in-out infinite 0.15s',
        'flyer-float-front': 'flyer-float-front 2.2s ease-in-out infinite 0.08s',
        'flyer-shimmer': 'flyer-shimmer 1.15s ease-in-out infinite',
        'flyer-dot': 'flyer-dot 1s ease-in-out infinite',
        'flyer-dot-delay-1': 'flyer-dot 1s ease-in-out infinite 0.15s',
        'flyer-dot-delay-2': 'flyer-dot 1s ease-in-out infinite 0.3s',
        'flyer-hint-fade': 'flyer-hint-fade 2.2s ease-in-out infinite'
      }
    },
  },
  plugins: [],
} satisfies Config
