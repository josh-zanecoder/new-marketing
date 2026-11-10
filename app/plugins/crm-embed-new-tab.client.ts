import { isMarketingEmbedded } from '~/composables/useMarketingEmbed'
import { marketingTenantHandoffCookieBase } from '~~/shared/marketingTenantHandoffCookies'
import {
  buildCrmMarketingTabUrl,
  crmMarketingPageBase,
  marketingTenantPathFromHref,
  originFromHttpUrl,
  safeMarketingTenantPath
} from '~~/shared/crmMarketingTabUrl'

const CRM_MARKETING_BASE_KEY = 'marketing.crmMarketingBase'
const CRM_TAB_BASE_COOKIE = 'marketing_crm_tab_base'

function readStoredCrmMarketingBase(): string {
  try {
    return sessionStorage.getItem(CRM_MARKETING_BASE_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

function writeStoredCrmMarketingBase(value: string): void {
  const v = value.trim()
  if (!v) return
  try {
    sessionStorage.setItem(CRM_MARKETING_BASE_KEY, v)
  } catch {
    /* ignore */
  }
}

/**
 * CRM iframe: rewrite internal links so “open in new tab” stays in CRM (Back stays visible).
 * Top-level tab with the CRM embed cookie: bounce to CRM `/marketing?path=…`.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const { data: me } = useMarketingMe()
  const crmTabBaseCookie = useCookie<string | null>(
    CRM_TAB_BASE_COOKIE,
    marketingTenantHandoffCookieBase()
  )

  function persistCrmBase(value: string): void {
    const v = value.trim()
    if (!v) return
    writeStoredCrmMarketingBase(v)
    crmTabBaseCookie.value = v
  }

  if (!isMarketingEmbedded()) {
    const embedCookie = useCookie<string | null>(
      'marketing_crm_embed',
      marketingTenantHandoffCookieBase()
    )
    if (embedCookie.value !== '1') return
    const route = useRoute()
    let bounced = false
    function bounceToCrm(): void {
      if (bounced) return
      const path = safeMarketingTenantPath(route.fullPath)
      if (!path) return
      const base =
        crmMarketingPageBase(me.value?.crmAppUrl, '', window.location.origin) ||
        crmMarketingPageBase(crmTabBaseCookie.value, '', window.location.origin)
      if (!base || originFromHttpUrl(base) === originFromHttpUrl(window.location.origin)) return
      const url = buildCrmMarketingTabUrl(base, path)
      if (!url) return
      bounced = true
      window.location.replace(url)
    }
    watch(me, bounceToCrm, { immediate: true })
    bounceToCrm()
    return
  }

  const parentReferrer =
    originFromHttpUrl(document.referrer) !== originFromHttpUrl(window.location.origin)
      ? document.referrer
      : ''
  const fromReferrer = crmMarketingPageBase(null, parentReferrer, window.location.origin)
  if (fromReferrer) persistCrmBase(fromReferrer)

  function crmBase(): string {
    const next = crmMarketingPageBase(
      me.value?.crmAppUrl,
      parentReferrer,
      window.location.origin
    )
    if (next) persistCrmBase(next)
    return next || readStoredCrmMarketingBase() || String(crmTabBaseCookie.value ?? '').trim()
  }

  function anchorFromEvent(event: Event): HTMLAnchorElement | null {
    const target = event.target
    if (!(target instanceof Element)) return null
    const anchor = target.closest('a')
    return anchor instanceof HTMLAnchorElement ? anchor : null
  }

  function pathFromAnchor(anchor: HTMLAnchorElement): string {
    const fromHref = marketingTenantPathFromHref(anchor.getAttribute('href') || '', window.location.origin)
    if (fromHref) return fromHref
    return safeMarketingTenantPath(anchor.dataset.marketingPath || '')
  }

  /** Point one link at CRM only for the gesture that is about to open a new tab. */
  function armNewTab(anchor: HTMLAnchorElement): void {
    const path = pathFromAnchor(anchor)
    if (!path) return
    const base = crmBase()
    if (!base) return
    const crmHref = buildCrmMarketingTabUrl(base, path)
    if (!crmHref) return
    anchor.dataset.marketingPath = path
    anchor.dataset.marketingCrmHref = crmHref
    if (anchor.getAttribute('href') !== crmHref) anchor.setAttribute('href', crmHref)
  }

  function isNewTabGesture(event: MouseEvent | PointerEvent): boolean {
    return event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
  }

  function onPointerDown(event: PointerEvent): void {
    if (!isNewTabGesture(event)) return
    const anchor = anchorFromEvent(event)
    if (anchor) armNewTab(anchor)
  }

  function onContextMenu(event: MouseEvent): void {
    const anchor = anchorFromEvent(event)
    if (anchor) armNewTab(anchor)
  }

  function onClick(event: MouseEvent): void {
    const anchor = anchorFromEvent(event)
    if (!anchor || event.defaultPrevented || isNewTabGesture(event) || event.button !== 0) return
    const path = pathFromAnchor(anchor)
    if (!path) return
    event.preventDefault()
    event.stopImmediatePropagation()
    void navigateTo(path)
  }

  nuxtApp.hook('app:mounted', () => {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('click', onClick, true)
  })
})
