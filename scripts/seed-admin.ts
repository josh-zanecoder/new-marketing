/**
 * Create or update Marketing admin users (Firebase Auth + registry `users` collection).
 *
 *   npm run seed:admin
 *   npm run seed:admin:production
 *
 * Required env:
 *   SEED_ADMIN_PASSWORD
 *   SEED_ADMIN_EMAIL  (single)  OR  SEED_ADMIN_EMAILS  (comma-separated)
 *   MONGODB_URI
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Example:
 *   SEED_ADMIN_EMAILS=hans@zanecoder.com,josh@zanecoder.com \
 *   SEED_ADMIN_PASSWORD='YourPassword' \
 *   npm run seed:admin:production
 *
 * Optional:
 *   MONGODB_DB_NAME (default: marketing)
 *   --update-password  reset Firebase password when users already exist
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import mongoose from 'mongoose'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const useProductionEnv = process.argv.includes('--production')
loadEnv({
  path: join(rootDir, useProductionEnv ? '.env.production' : '.env'),
  override: true
})

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? ''
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return value
}

function resolveAdminEmails(): string[] {
  const fromList = (process.env.SEED_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (fromList.length) return fromList
  const single = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  if (single) return [single]
  console.error('Set SEED_ADMIN_EMAIL or SEED_ADMIN_EMAILS')
  process.exit(1)
}

function initFirebaseAdmin(): Auth {
  if (getApps().length) return getAuth()
  const projectId = requireEnv('FIREBASE_PROJECT_ID')
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL')
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  })
  return getAuth()
}

function printFirebaseAuthSetupHelp(projectId: string) {
  console.error(`
Firebase Authentication is not set up for project "${projectId}".

1. Open https://console.firebase.google.com/project/${projectId}/authentication
2. Click "Get started" (if shown)
3. Sign-in method → Email/Password → Enable → Save
4. Re-run this seed command.
`)
}

function isFirebaseAuthNotConfigured(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = 'code' in err ? String((err as { code: unknown }).code) : ''
  return code === 'auth/configuration-not-found'
}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  firebaseUid: { type: String, required: true, unique: true, index: true },
  role: {
    type: String,
    enum: ['admin', 'tenant', 'client'],
    default: 'tenant',
    required: true
  },
  tenantId: { type: String, default: null }
})

async function seedOneAdmin(params: {
  auth: Auth
  User: mongoose.Model<unknown>
  email: string
  password: string
  updatePassword: boolean
}) {
  const { auth, User, email, password, updatePassword } = params
  let firebaseUser = await auth.getUserByEmail(email).catch(() => null)

  if (!firebaseUser) {
    firebaseUser = await auth.createUser({
      email,
      password,
      emailVerified: true
    })
    console.log(`Created Firebase user: ${email} (${firebaseUser.uid})`)
  } else {
    console.log(`Firebase user exists: ${email} (${firebaseUser.uid})`)
    if (updatePassword) {
      await auth.updateUser(firebaseUser.uid, { password })
      console.log(`Updated Firebase password: ${email}`)
    }
  }

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    await User.updateOne(
      { email },
      { $set: { firebaseUid: firebaseUser.uid, role: 'admin', tenantId: null } }
    )
    console.log(`Updated MongoDB admin: ${email}`)
  } else {
    await User.create({
      email,
      firebaseUid: firebaseUser.uid,
      role: 'admin',
      tenantId: null
    })
    console.log(`Inserted MongoDB admin: ${email}`)
  }
}

async function main() {
  const emails = resolveAdminEmails()
  const password = requireEnv('SEED_ADMIN_PASSWORD')
  const updatePassword = process.argv.includes('--update-password')

  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be at least 8 characters')
    process.exit(1)
  }

  const uri = requireEnv('MONGODB_URI')
  const registryDb = process.env.MONGODB_DB_NAME?.trim() || 'marketing'
  const projectId = requireEnv('FIREBASE_PROJECT_ID')

  const auth = initFirebaseAdmin()
  try {
    await auth.listUsers(1)
  } catch (err) {
    if (isFirebaseAuthNotConfigured(err)) {
      printFirebaseAuthSetupHelp(projectId)
      process.exit(1)
    }
    throw err
  }

  await mongoose.connect(uri, { dbName: registryDb })
  const User = mongoose.models.User || mongoose.model('User', userSchema)

  for (const email of emails) {
    await seedOneAdmin({ auth, User, email, password, updatePassword })
  }

  console.log(`Done. ${emails.length} admin(s) ready for Marketing Login.`)
  await mongoose.disconnect()
}

main().catch((err) => {
  if (isFirebaseAuthNotConfigured(err)) {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || 'your-project'
    printFirebaseAuthSetupHelp(projectId)
    process.exit(1)
  }
  console.error(err)
  process.exit(1)
})
