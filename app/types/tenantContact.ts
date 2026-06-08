/**
 * Tenant contact shapes returned by marketing APIs (JSON).
 * `ContactKind` is a tenant `contact_types` key string (see `@server/types/tenant/contact.model`).
 */
import type { ContactKind, ContactProfile } from '@server/types/tenant/contact.model'

export type { ContactKind, ContactProfile }

/** Registry option from `contact_types` (GET contacts / recipient-list). */
export interface TenantContactTypeOption {
  key: string
  label: string
  sortOrder: number
  enabled?: boolean
}

/** GET `/api/v1/tenant/contacts` — one row. */
export interface TenantContactListRow {
  id: string
  externalId: string
  source: string
  contactType: string[]
  contactTypeLabels: string[]
  /** Label for the first type key (single-chip fallback). */
  primaryTypeLabel: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  company: string
  channel: string
  ownerEmail?: string
  is_unsubscribe: boolean
  address: {
    street: string
    city: string
    state: string
    county: string
  }
  /** Present when contact is a partner with retail type / subtype keys. */
  contactProfile?: ContactProfile | null
  createdAt: string | null
  updatedAt: string | null
}

/** GET `/api/v1/tenant/contacts/:id` — full contact for detail view. */
export interface TenantContactDetail extends TenantContactListRow {
  status: string
  stage: string
  metadata: Record<string, unknown>
  deletedAt: string | null
}

/** GET `/api/v1/tenant/contacts/:id` response body. */
export interface TenantContactDetailPayload {
  contact: TenantContactDetail
}

/** GET `/api/v1/tenant/contacts` response body. */
export interface TenantContactsListPayload {
  contacts: TenantContactListRow[]
  contactTypes?: TenantContactTypeOption[]
  total: number
  truncated: boolean
}

/** Contact row from GET `/api/v1/tenant/recipient-list` (picker / catalog). */
export interface TenantRecipientListCatalogContact {
  id: string
  name?: string
  email?: string
  company?: string
  contactType?: string[]
  contactProfile?: ContactProfile | null
}

/** GET `/api/v1/tenant/recipient-list/:id` — one member row. */
export interface TenantRecipientListMemberRow {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  contactType?: string[]
  company: string
  channel: string
  source: string
  address: Record<string, unknown>
  contactProfile?: ContactProfile | null
}

/** GET `/api/v1/tenant/recipient-list` resource wrapper (lists + contacts catalog). */
export interface TenantRecipientListResourcePayload {
  lists?: Array<{ id: string; name: string }>
  contacts?: TenantRecipientListCatalogContact[]
  contactsTruncated?: boolean
  /** Counts per `contactType` key (union of registry types, filters, and distinct contact values). */
  contactCounts?: Record<string, number>
  contactTypes?: TenantContactTypeOption[]
}

/** GET `/api/v1/tenant/recipient-list?scope=index` — list index page only. */
export interface TenantRecipientListIndexPayload {
  tenantIdConfigured: boolean
  lists: Array<{
    id: string
    name: string
    audience: string
    filters: TenantRecipientListCriterion[]
    filterMode?: 'and' | 'or'
    updatedAt: string | null
    memberCount?: number | null
  }>
  recipientFilters: Array<{
    id: string
    name: string
    contactType: string
    property: string
    propertyType: string
    propertyValue: string
    enabled: boolean
  }>
  contactTypes?: TenantContactTypeOption[]
}

export interface TenantRecipientListCriterion {
  property: string
  value: string
}

export interface TenantRecipientListFilterRow {
  recipientFilterId: string
  listPropertyValue: string
}

/** List header from GET `/api/v1/tenant/recipient-list/:id`. */
export interface TenantRecipientListDetailList {
  id: string
  name: string
  listType: string
  audience: string
  filters: TenantRecipientListCriterion[]
  filterMode?: 'and' | 'or'
  criterionJoins?: ('and' | 'or')[]
  criteriaChain?: {
    rows: TenantRecipientListCriterion[]
    joins: ('and' | 'or')[] | null
  } | null
  filterRows?: TenantRecipientListFilterRow[]
  membershipScope?: 'tenant' | 'owner_emails'
  membershipOwnerEmails?: string[]
  createdAt: string | null
  updatedAt: string | null
}

/** GET `/api/v1/tenant/recipient-list/:id` — full response. */
export interface TenantRecipientListDetailPayload {
  list: TenantRecipientListDetailList
  members: TenantRecipientListMembersPage
}

export interface TenantRecipientListMembersPage {
  items: TenantRecipientListMemberRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** GET `/api/v1/tenant/recipient-list/:id?scope=edit` — edit form hydration only. */
export interface TenantRecipientListEditPayload {
  list: {
    name: string
    audience: string
    filterMode?: 'and' | 'or'
    criterionJoins?: ('and' | 'or')[]
    filterRows?: TenantRecipientListFilterRow[]
  }
}

/** GET `/api/v1/tenant/recipient-list?scope=lists` — dropdown options only. */
export interface TenantRecipientListOptionsPayload {
  lists: Array<{ id: string; name: string }>
}

/** GET `/api/v1/tenant/recipient-list?scope=picker` — manual campaign contact picker. */
export interface TenantRecipientListPickerPayload {
  contacts: TenantRecipientListCatalogContact[]
  contactsTruncated?: boolean
  contactCounts?: Record<string, number>
  contactTypes?: TenantContactTypeOption[]
}

/** Manual campaign contact picker (subset of catalog with required name/email). */
export interface CampaignContactPickerRow {
  id: string
  name: string
  email: string
  company?: string
  contactType?: string[]
}
