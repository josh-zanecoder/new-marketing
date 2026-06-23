import type { Ref } from 'vue'
import { normalizeContactCounty } from '~~/shared/utils/contactAddress'

type PlaceAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlacePredictionSelectEvent = {
  placePrediction: {
    toPlace: () => PlaceLike
  }
}

type PlaceLike = {
  addressComponents?: PlaceAddressComponent[]
  fetchFields: (options: { fields: string[] }) => Promise<void>
}

type PlaceAutocompleteElementInstance = HTMLElement & {
  placeholder?: string
  value?: string
  includedRegionCodes?: string[]
  noInputIcon?: boolean
  noClearButton?: boolean
  style: CSSStyleDeclaration
}

type PlacesLibrary = {
  PlaceAutocompleteElement: new (options?: {
    includedPrimaryTypes?: string[]
    includedRegionCodes?: string[]
    noInputIcon?: boolean
    noClearButton?: boolean
  }) => PlaceAutocompleteElementInstance
}

type GoogleMapsNamespace = {
  maps: {
    importLibrary: (name: string) => Promise<PlacesLibrary>
  }
}

type WindowWithGoogleMaps = Window & { google?: GoogleMapsNamespace }

type AddressAutocompleteFieldKeys = {
  street: string
  city: string
  state: string
  county?: string
  unit?: string
  zipCode?: string
}

type AddressAutocompleteForm = Record<string, unknown>

let googleMapsLoaderPromise: Promise<PlacesLibrary> | null = null
let warnedMissingApiKey = false

function getGoogleMapsNamespace(): GoogleMapsNamespace | null {
  return (window as WindowWithGoogleMaps).google ?? null
}

function getGoogleMapsApiKey(config: ReturnType<typeof useRuntimeConfig>): string {
  return String(
    config.public.googleMapsApiKey ||
      import.meta.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
  ).trim()
}

async function waitForImportLibrary(timeoutMs = 10000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (getGoogleMapsNamespace()?.maps?.importLibrary) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Google Maps importLibrary was not available')
}

async function loadGooglePlacesLibrary(
  config: ReturnType<typeof useRuntimeConfig>
): Promise<PlacesLibrary | null> {
  const apiKey = getGoogleMapsApiKey(config)
  if (!apiKey) {
    if (import.meta.dev && !warnedMissingApiKey) {
      warnedMissingApiKey = true
      console.warn(
        '[useGoogleAddressAutocomplete] Missing Google Maps API key. Set NUXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env and restart the dev server.'
      )
    }
    return null
  }

  if (googleMapsLoaderPromise) return googleMapsLoaderPromise

  googleMapsLoaderPromise = (async () => {
    if (!getGoogleMapsNamespace()?.maps?.importLibrary) {
      await new Promise<void>((resolve, reject) => {
        const params = new URLSearchParams({
          key: apiKey,
          v: 'weekly',
          loading: 'async'
        })
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Google Maps JavaScript API'))
        document.head.appendChild(script)
      })
      await waitForImportLibrary()
    }
    return getGoogleMapsNamespace()!.maps.importLibrary('places') as Promise<PlacesLibrary>
  })()

  return googleMapsLoaderPromise
}

function getAddressComponent(
  components: PlaceAddressComponent[],
  type: string
): PlaceAddressComponent | undefined {
  return components.find((component) => component.types?.includes(type))
}

function componentText(
  component: PlaceAddressComponent | undefined,
  preferShort = false
): string {
  if (!component) return ''
  if (preferShort) return component.shortText ?? component.longText ?? ''
  return component.longText ?? component.shortText ?? ''
}

function applyPlaceAddressToForm(
  place: PlaceLike,
  formRef: Ref<AddressAutocompleteForm>,
  keys: AddressAutocompleteFieldKeys
): string {
  const components = place.addressComponents ?? []
  const streetNumber = componentText(getAddressComponent(components, 'street_number'))
  const route = componentText(getAddressComponent(components, 'route'))
  const unit = componentText(getAddressComponent(components, 'subpremise'))
  const city =
    componentText(getAddressComponent(components, 'locality')) ||
    componentText(getAddressComponent(components, 'sublocality')) ||
    componentText(getAddressComponent(components, 'postal_town'))
  const state = componentText(getAddressComponent(components, 'administrative_area_level_1'), true)
  const county = normalizeContactCounty(
    componentText(getAddressComponent(components, 'administrative_area_level_2'))
  )
  const zipCode = componentText(getAddressComponent(components, 'postal_code'))
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()

  formRef.value[keys.street] = street
  formRef.value[keys.city] = city
  formRef.value[keys.state] = state
  if (keys.county) formRef.value[keys.county] = county
  if (keys.unit) formRef.value[keys.unit] = unit
  if (keys.zipCode && zipCode) formRef.value[keys.zipCode] = zipCode

  return street
}

/** Align PlaceAutocompleteElement with tenant contact text inputs (see google-places.css). */
function applyTenantPlaceAutocompleteStyles(element: PlaceAutocompleteElementInstance): void {
  element.noInputIcon = true
  element.noClearButton = true
  element.setAttribute('no-input-icon', '')
  element.setAttribute('no-clear-button', '')
  element.style.width = '100%'
}

/**
 * Google Places Autocomplete (New) via PlaceAutocompleteElement.
 * Required: Places API (New) + Maps JavaScript API enabled for the API key.
 */
export function useGoogleAddressAutocomplete(
  formRef: Ref<AddressAutocompleteForm>,
  fieldKeys: Partial<AddressAutocompleteFieldKeys> = {}
) {
  const config = useRuntimeConfig()
  let selectHandler: ((event: Event) => void) | null = null
  let errorHandler: ((event: Event) => void) | null = null
  let inputHandler: ((event: Event) => void) | null = null
  let autocompleteElement: PlaceAutocompleteElementInstance | null = null
  let boundHost: HTMLElement | null = null

  const keys: AddressAutocompleteFieldKeys = {
    street: fieldKeys.street ?? 'street',
    city: fieldKeys.city ?? 'city',
    state: fieldKeys.state ?? 'state',
    county: fieldKeys.county,
    zipCode: fieldKeys.zipCode
  }

  function clearGoogleAutocompleteListener(): void {
    if (autocompleteElement && selectHandler) {
      autocompleteElement.removeEventListener('gmp-select', selectHandler)
    }
    if (autocompleteElement && errorHandler) {
      autocompleteElement.removeEventListener('gmp-error', errorHandler)
    }
    if (autocompleteElement && inputHandler) {
      autocompleteElement.removeEventListener('input', inputHandler)
    }
    if (boundHost) boundHost.replaceChildren()
    selectHandler = null
    errorHandler = null
    inputHandler = null
    autocompleteElement = null
    boundHost = null
  }

  async function initGoogleAddressAutocomplete(
    hostRef: Ref<HTMLElement | null>,
    streetFieldVisible: boolean,
    options?: { placeholder?: string; regionCodes?: string[] }
  ): Promise<boolean> {
    if (!streetFieldVisible) return false
    const host = hostRef.value
    if (!host) return false
    if (boundHost === host && autocompleteElement) return true

    try {
      const placesLibrary = await loadGooglePlacesLibrary(config)
      if (!placesLibrary?.PlaceAutocompleteElement) return false

      clearGoogleAutocompleteListener()
      host.replaceChildren()

      const placeAutocomplete = new placesLibrary.PlaceAutocompleteElement({
        includedRegionCodes: options?.regionCodes ?? ['us'],
        noInputIcon: true,
        noClearButton: true
      })
      const placeholder = options?.placeholder ?? '123 Main Street'
      placeAutocomplete.placeholder = placeholder
      placeAutocomplete.className = 'tenant-place-autocomplete'
      applyTenantPlaceAutocompleteStyles(placeAutocomplete)
      const existingStreet = String(formRef.value[keys.street] ?? '').trim()
      if (existingStreet) {
        placeAutocomplete.value = existingStreet
      }

      selectHandler = async (event: Event) => {
        const placePrediction = (event as Event & PlacePredictionSelectEvent).placePrediction
        if (!placePrediction) return
        const place = placePrediction.toPlace()
        await place.fetchFields({ fields: ['addressComponents'] })
        const street = applyPlaceAddressToForm(place, formRef, keys)
        await nextTick()
        placeAutocomplete.value = street
        formRef.value[keys.street] = street
      }

      errorHandler = () => {
        if (import.meta.dev) {
          console.warn(
            '[useGoogleAddressAutocomplete] Places API request blocked. Enable Places API (New) on the project and add it to API key restrictions alongside Maps JavaScript API.'
          )
        }
      }

      inputHandler = () => {
        formRef.value[keys.street] = placeAutocomplete.value?.trim() ?? ''
      }

      placeAutocomplete.addEventListener('gmp-select', selectHandler)
      placeAutocomplete.addEventListener('gmp-error', errorHandler)
      placeAutocomplete.addEventListener('input', inputHandler)

      host.appendChild(placeAutocomplete)
      boundHost = host
      autocompleteElement = placeAutocomplete
      return true
    } catch (err) {
      console.warn('Google Places autocomplete failed to initialize:', err)
      return false
    }
  }

  return { initGoogleAddressAutocomplete, clearGoogleAutocompleteListener }
}
