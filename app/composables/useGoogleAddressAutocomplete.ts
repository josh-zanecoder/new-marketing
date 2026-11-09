import type { Ref } from 'vue'
import { normalizeContactCounty } from '~~/shared/utils/contactAddress'

type GoogleAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GooglePlaceResult = {
  address_components?: GoogleAddressComponent[]
}

type GoogleMapsEventListener = {
  remove: () => void
}

type GoogleAutocomplete = {
  addListener: (eventName: string, handler: () => void) => GoogleMapsEventListener
  getPlace: () => GooglePlaceResult
}

type GoogleMapsNamespace = {
  maps: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: {
          types: string[]
          fields: string[]
          componentRestrictions: { country: string }
        }
      ) => GoogleAutocomplete
    }
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

const AUTOCOMPLETE_OPTIONS = {
  types: ['address'],
  fields: ['address_components'],
  componentRestrictions: { country: 'us' }
} as const

let googlePlacesLoaderPromise: Promise<void> | null = null
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

async function loadGooglePlacesScript(config: ReturnType<typeof useRuntimeConfig>): Promise<void> {
  const apiKey = getGoogleMapsApiKey(config)
  if (!apiKey) {
    if (import.meta.dev && !warnedMissingApiKey) {
      warnedMissingApiKey = true
      console.warn(
        '[useGoogleAddressAutocomplete] Missing Google Maps API key. Set NUXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env and restart the dev server.'
      )
    }
    return
  }
  if (getGoogleMapsNamespace()?.maps?.places?.Autocomplete) return
  if (!googlePlacesLoaderPromise) {
    googlePlacesLoaderPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        googlePlacesLoaderPromise = null
        reject(new Error('Failed to load Google Maps Places script'))
      }
      document.head.appendChild(script)
    })
  }
  try {
    await googlePlacesLoaderPromise
  } catch (error) {
    googlePlacesLoaderPromise = null
    throw error
  }
}

function getAddressComponent(
  components: GoogleAddressComponent[],
  type: string
): GoogleAddressComponent | undefined {
  return components.find((component) => component.types.includes(type))
}

function isUnitedStatesAddress(components: GoogleAddressComponent[]): boolean {
  const country = getAddressComponent(components, 'country')
  if (!country) return false
  return (
    country.short_name.trim().toUpperCase() === 'US' ||
    country.long_name.trim().toLowerCase() === 'united states'
  )
}

function applyPlaceAddressToForm(
  place: GooglePlaceResult,
  formRef: Ref<AddressAutocompleteForm>,
  keys: AddressAutocompleteFieldKeys
): string | null {
  const components = place.address_components ?? []
  if (!components.length || !isUnitedStatesAddress(components)) return null

  const streetNumber = getAddressComponent(components, 'street_number')?.long_name ?? ''
  const route = getAddressComponent(components, 'route')?.long_name ?? ''
  const unit = getAddressComponent(components, 'subpremise')?.long_name ?? ''
  const city =
    getAddressComponent(components, 'locality')?.long_name ||
    getAddressComponent(components, 'sublocality_level_1')?.long_name ||
    getAddressComponent(components, 'sublocality')?.long_name ||
    getAddressComponent(components, 'postal_town')?.long_name ||
    ''
  const state = getAddressComponent(components, 'administrative_area_level_1')?.short_name ?? ''
  const county = normalizeContactCounty(
    getAddressComponent(components, 'administrative_area_level_2')?.long_name ?? ''
  )
  const zipCode = getAddressComponent(components, 'postal_code')?.long_name ?? ''
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()

  formRef.value[keys.street] = street
  formRef.value[keys.city] = city
  formRef.value[keys.state] = state
  if (keys.county) formRef.value[keys.county] = county
  if (keys.unit) formRef.value[keys.unit] = unit
  if (keys.zipCode) formRef.value[keys.zipCode] = zipCode

  return street
}

/**
 * Classic Google Places Autocomplete, same widget the CRM uses.
 * Requires Maps JavaScript API and the Places library. Does not call Places API (New).
 */
export function useGoogleAddressAutocomplete(
  formRef: Ref<AddressAutocompleteForm>,
  fieldKeys: Partial<AddressAutocompleteFieldKeys> = {}
) {
  const config = useRuntimeConfig()
  let autocompleteListener: GoogleMapsEventListener | null = null
  let boundInput: HTMLInputElement | null = null

  const keys: AddressAutocompleteFieldKeys = {
    street: fieldKeys.street ?? 'street',
    city: fieldKeys.city ?? 'city',
    state: fieldKeys.state ?? 'state',
    county: fieldKeys.county,
    unit: fieldKeys.unit,
    zipCode: fieldKeys.zipCode
  }

  function syncStreetValueFromForm(): void {
    if (!boundInput) return
    boundInput.value = String(formRef.value[keys.street] ?? '')
  }

  function clearGoogleAutocompleteListener(): void {
    autocompleteListener?.remove()
    autocompleteListener = null
    boundInput = null
  }

  async function initGoogleAddressAutocomplete(
    streetInputRef: Ref<HTMLInputElement | null>,
    streetFieldVisible: boolean
  ): Promise<boolean> {
    if (!streetFieldVisible) return false
    const input = streetInputRef.value
    if (!input) return false
    if (boundInput === input && autocompleteListener) {
      syncStreetValueFromForm()
      return true
    }

    try {
      await loadGooglePlacesScript(config)
      const Autocomplete = getGoogleMapsNamespace()?.maps?.places?.Autocomplete
      if (!Autocomplete) return false

      clearGoogleAutocompleteListener()
      const autocomplete = new Autocomplete(input, AUTOCOMPLETE_OPTIONS)
      autocompleteListener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const street = applyPlaceAddressToForm(place, formRef, keys)
        if (street === null) return
        input.value = street
      })
      boundInput = input
      syncStreetValueFromForm()
      return true
    } catch (err) {
      console.warn('Google Maps autocomplete failed to initialize:', err)
      return false
    }
  }

  return {
    initGoogleAddressAutocomplete,
    clearGoogleAutocompleteListener,
    syncStreetValueFromForm
  }
}
