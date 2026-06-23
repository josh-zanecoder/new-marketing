import { useMediaQuery, useTheme } from '@mui/material'

/** Viewports below `lg` (1200px) use overlay drawers so the canvas keeps room on tablets. */
export function isOverlayDrawerViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 1199.95px)').matches
}

/** @deprecated Use isOverlayDrawerViewport */
export function isCompactLayoutViewport(): boolean {
  return isOverlayDrawerViewport()
}

export function useOverlayDrawers(): boolean {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('lg'))
}

/** Toolbar hides secondary actions (download, import, share) below `md` (900px). */
export function useToolbarMinimal(): boolean {
  return false
}

/** Share stays hidden below `lg` on medium-width layouts. */
export function useToolbarCompact(): boolean {
  return false
}

/** Phone-only tweaks below `sm` (600px). */
export function usePhoneLayout(): boolean {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}

/** @deprecated Use useOverlayDrawers */
export function useCompactLayout(): boolean {
  return useOverlayDrawers()
}
