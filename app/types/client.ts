export interface AdminClient {
  name: string
  email: string | null
  dbName: string
  clientKeyPrefix: string | null
  status: string
}

