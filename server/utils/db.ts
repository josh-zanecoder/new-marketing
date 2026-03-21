import mongoose from 'mongoose'

const clientConnections = new Map<string, mongoose.Connection>()

function resolveRegistryMongoConfig(): { uri: string; dbName: string } {
  try {
    const config = useRuntimeConfig()
    const uri =
      (config.mongodbUri as string) || process.env.MONGODB_URI || ''
    const dbName =
      (config.mongodbDbName as string) ||
      process.env.MONGODB_DB_NAME ||
      'marketing'
    return { uri, dbName }
  } catch {
    return {
      uri: process.env.MONGODB_URI || '',
      dbName: process.env.MONGODB_DB_NAME || 'marketing'
    }
  }
}

/** Connect to the shared Registry DB (clients, api keys, connection strings) */
export async function getRegistryConnection(): Promise<mongoose.Connection> {
  const { uri, dbName: resolvedDbName } = resolveRegistryMongoConfig()
  if (!uri) {
    throw new Error('MONGODB_URI is not configured (nuxt.config runtimeConfig.mongodbUri or MONGODB_URI)')
  }

  const conn = mongoose.connection
  const onCorrectDb =
    conn.readyState === 1 && conn.db?.databaseName === resolvedDbName

  if (onCorrectDb) {
    return conn
  }

  if (conn.readyState !== 0) {
    await mongoose.disconnect()
  }
  await mongoose.connect(uri, { dbName: resolvedDbName })
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
