/** Stock EmailBuilder preview widths (mobile 370px, desktop 600px canvas). */
export const MOBILE_PREVIEW_WIDTH = 370
export const DESKTOP_PREVIEW_WIDTH = 600

export function importedHtmlPreviewShellSx(mobile: boolean) {
  return {
    width: mobile ? MOBILE_PREVIEW_WIDTH : '100%',
    maxWidth: mobile ? MOBILE_PREVIEW_WIDTH : DESKTOP_PREVIEW_WIDTH,
    mx: 'auto',
    flexShrink: 0,
    bgcolor: 'white',
    boxShadow:
      'rgba(33, 36, 67, 0.04) 0px 10px 20px, rgba(33, 36, 67, 0.04) 0px 2px 6px, rgba(33, 36, 67, 0.04) 0px 0px 1px',
    overflow: 'hidden',
  } as const
}

export function importedHtmlPreviewIframeSx(_mobile: boolean) {
  return {
    display: 'block',
    width: '100%',
    minHeight: 320,
    border: 0,
    bgcolor: 'white',
    verticalAlign: 'top',
  } as const
}
