// Mongoose layer: default registry connection + pooled connections by URI (getClientConnection).
import mongoose from 'mongoose'

const clientConnections = new Map<string, mongoose.Connection>()

/** Shared driver options for registry and per-tenant connections. */
function mongoConnectionOptions(): mongoose.ConnectOptions {
  return {
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000
  }
}

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

  // Close only the default connection. Never use mongoose.disconnect() here — it tears down
  // every connection (including tenant pools from createConnection) and causes reconnect churn.
  if (conn.readyState !== 0 && conn.readyState !== 99) {
    await conn.close()
  }
  await mongoose.connect(uri, {
    dbName: resolvedDbName,
    ...mongoConnectionOptions()
  })
  return mongoose.connection
}

/** Get or create a Mongoose connection for a client's database */
export async function getClientConnection(connectionString: string): Promise<mongoose.Connection> {
  const existing = clientConnections.get(connectionString)
  if (existing) {
    if (existing.readyState === 1) return existing
    // 2 = connecting — wait instead of opening a second pool for the same URI
    if (existing.readyState === 2) {
      await existing.asPromise()
      return existing
    }
    try {
      await existing.close()
    } catch {
      /* ignore */
    }
    clientConnections.delete(connectionString)
  }

  const conn = mongoose.createConnection(
    connectionString,
    mongoConnectionOptions()
  )
  clientConnections.set(connectionString, conn)
  await conn.asPromise()
  return conn
}
