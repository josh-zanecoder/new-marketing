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
export default defineNuxtPlugin(() => {
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

  function applyAnchor(a: HTMLAnchorElement): void {
    const stored = a.dataset.marketingPath?.trim() || ''
    const href = a.getAttribute('href') || ''
    const fromHref = marketingTenantPathFromHref(href, window.location.origin)
    const path = fromHref || stored
    if (!path) return
    const base = crmBase()
    if (!base) return
    const crmHref = buildCrmMarketingTabUrl(base, path)
    if (!crmHref) return
    a.dataset.marketingPath = path
    if (a.dataset.marketingCrmHref === crmHref) return
    a.dataset.marketingCrmHref = crmHref
    a.setAttribute('href', crmHref)
  }

  function scan(): void {
    document.querySelectorAll('a[href]').forEach((el) => {
      applyAnchor(el as HTMLAnchorElement)
    })
  }

  function onClick(event: MouseEvent): void {
    const target = event.target
    if (!(target instanceof Element)) return
    const a = target.closest('a')
    if (!(a instanceof HTMLAnchorElement)) return
    const path = a.dataset.marketingPath?.trim()
    if (!path) return
    if (event.defaultPrevented) return
    if (event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    if (event.button !== 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    void navigateTo(path)
  }

  document.addEventListener('click', onClick, true)
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href']
  })
  watch(me, scan, { immediate: true })
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true })
  } else {
    scan()
  }
})
