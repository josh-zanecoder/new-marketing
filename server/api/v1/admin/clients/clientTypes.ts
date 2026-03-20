export interface RegistryClientDoc {
  _id?: unknown
  name?: unknown
  email?: unknown
  dbName?: unknown
  clientKeyPrefix?: unknown
  createdAt?: unknown
}

export interface ClientResponse {
  name: string
  email: string | null
  dbName: string
  clientKeyPrefix: string | null
  createdAt: string
}

