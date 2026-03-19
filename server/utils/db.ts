import mongoose from 'mongoose'

const clientConnections = new Map<string, mongoose.Connection>()

/** Connect to the shared Registry DB (clients, api keys, connection strings) */
export async function getRegistryConnection(): Promise<mongoose.Connection> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  const config = useRuntimeConfig()
  const uri = config.mongodbUri
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
