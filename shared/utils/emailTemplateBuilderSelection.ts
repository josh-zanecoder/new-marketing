/**
 * Single-active selection helpers for Template Builder Sections / Images tabs.
 */

/** Clicking the active id again clears it; otherwise the clicked id becomes active. */
export function toggleSelectionId<T extends string | number>(
  current: T | null | undefined,
  clicked: T
): T | null {
  return current === clicked ? null : clicked
}

export type EmailBuilderSidePanel = 'add' | 'layout' | 'email' | 'uploads'

/**
 * Leaving Sections clears section selection; leaving Images clears image selection.
 * Selecting into a tab from the canvas should call the clear helpers explicitly too.
 */
export function selectionClearOnSidePanelChange(
  previous: EmailBuilderSidePanel | null | undefined,
  next: EmailBuilderSidePanel
): { clearSection: boolean; clearImage: boolean } {
  return {
    clearSection: previous === 'layout' && next !== 'layout',
    clearImage: previous === 'email' && next !== 'email'
  }
}
