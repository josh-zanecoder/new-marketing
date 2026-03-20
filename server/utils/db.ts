import mongoose from 'mongoose'

const clientConnections = new Map<string, mongoose.Connection>()

/** Connect to the shared Registry DB (clients, api keys, connection strings) */
export async function getRegistryConnection(): Promise<mongoose.Connection> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  let uri = process.env.MONGODB_URI
  if (!uri) {
    try {
      const config = useRuntimeConfig()
      uri = config.mongodbUri as string
    } catch {
      /* BullMQ worker jobs run outside a request context */
    }
  }
  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }
  await mongoose.connect(uri)
  return mongoose.connection
}

/** Get or create a Mongoose connection for a client's database */
export async function getClientConnection(connectionString: string): Promise<mongoose.Connection> {
  const existing = clientConnections.get(connectionString)
  if (existing?.readyState === 1) return existing

  const conn = mongoose.createConnection(connectionString)
  clientConnections.set(connectionString, conn)
  await conn.asPromise()
  return conn
}
