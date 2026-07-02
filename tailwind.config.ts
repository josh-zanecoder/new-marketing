import type { Config } from 'tailwindcss'
import { mortdashTheme } from './.cursor/design-system/tailwind-theme.extend.js'

export default {
  theme: {
    extend: {
      ...mortdashTheme,
    },
  },
  plugins: [],
} satisfies Config
