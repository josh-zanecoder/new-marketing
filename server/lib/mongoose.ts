// Mongoose layer: default registry connection + pooled connections by URI (getClientConnection).
import mongoose from 'mongoose'

const clientConnections = new Map<string, mongoose.Connection>()
let registryConnectInFlight: Promise<mongoose.Connection> | null = null

export function isTransientMongoError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoNotConnectedError' ||
    err.name === 'MongooseServerSelectionError' ||
    msg.includes('replicasetnoprimary') ||
    msg.includes('server selection') ||
    msg.includes('could not connect to any servers') ||
    msg.includes('client must be connected') ||
    msg.includes('epipe') ||
    msg.includes('econnreset') ||
    msg.includes('connection') ||
    msg.includes('timed out')
  )
}

function registryConnectRetryDelayMs(attempt: number): number {
  return Math.min(15_000, 1_000 * attempt)
}

const DEFAULT_MONGODB_MAX_POOL_SIZE = 15

function resolveMaxPoolSize(): number {
  const raw = Number(process.env.MONGODB_MAX_POOL_SIZE)
  return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? Math.floor(raw) : DEFAULT_MONGODB_MAX_POOL_SIZE
}

/** Shared driver options for registry and per-tenant connections. */
function mongoConnectionOptions(): mongoose.ConnectOptions {
  return {
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: resolveMaxPoolSize()
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

/** Drop the default registry pool so the next getRegistryConnection() opens a fresh one. */
export async function invalidateRegistryConnection(): Promise<void> {
  registryConnectInFlight = null
  const conn = mongoose.connection
  if (conn.readyState === 0 || conn.readyState === 99) return
  try {
    await conn.close()
  } catch {
    /* ignore */
  }
}

async function openRegistryConnection(
  uri: string,
  resolvedDbName: string
): Promise<mongoose.Connection> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, {
        dbName: resolvedDbName,
        ...mongoConnectionOptions()
      })
      return mongoose.connection
    } catch (err) {
      await invalidateRegistryConnection()
      if (attempt >= maxAttempts || !isTransientMongoError(err)) throw err
      await new Promise((resolve) => setTimeout(resolve, registryConnectRetryDelayMs(attempt)))
    }
  }
  throw new Error('Registry Mongo connect failed after retries')
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

  if (registryConnectInFlight) {
    return registryConnectInFlight
  }

  registryConnectInFlight = (async () => {
    if (conn.readyState !== 0 && conn.readyState !== 99) {
      await invalidateRegistryConnection()
    }
    return openRegistryConnection(uri, resolvedDbName)
  })()

  try {
    return await registryConnectInFlight
  } finally {
    registryConnectInFlight = null
  }
}

/** Get or create a Mongoose connection for a client's database */
export async function getClientConnection(connectionString: string): Promise<mongoose.Connection> {
  const existing = clientConnections.get(connectionString)
  if (existing) {
    if (existing.readyState === 1) return existing
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
