export interface RegistryClientDoc {
  _id?: unknown
  name?: unknown
  email?: unknown
  dbName?: unknown
  tenantId?: unknown
  clientKeyPrefix?: unknown
  createdAt?: unknown
}

export interface ClientResponse {
  name: string
  email: string | null
  dbName: string
  tenantId: string | null
  clientKeyPrefix: string | null
  createdAt: string
}
