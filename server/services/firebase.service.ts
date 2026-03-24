import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

interface FirebaseEnv {
  projectId: string
  clientEmail: string
  privateKey: string
}

function getFirebaseEnv(): FirebaseEnv {
  const config = useRuntimeConfig()
  const projectId =
    (config.firebaseProjectId as string) ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NUXT_FIREBASE_PROJECT_ID ||
    ''
  const clientEmail =
    (config.firebaseClientEmail as string) ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.NUXT_FIREBASE_CLIENT_EMAIL ||
    ''
  const privateKeyRaw =
    (config.firebasePrivateKey as string) ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.NUXT_FIREBASE_PRIVATE_KEY ||
    ''

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw createError({
      statusCode: 500,
      message: 'Missing Firebase env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    })
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n')
  }
}

let firebaseApp: App | null = null

export function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp

  if (getApps().length) {
    firebaseApp = getApps()[0]!
    return firebaseApp
  }

  const env = getFirebaseEnv()
  firebaseApp = initializeApp({
    credential: cert({
      projectId: env.projectId,
      clientEmail: env.clientEmail,
      privateKey: env.privateKey
    })
  })
  return firebaseApp
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export async function verifyFirebaseIdToken(idToken: string) {
  try {
    return await getFirebaseAuth().verifyIdToken(idToken)
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'unknown'
    console.error('Firebase verifyIdToken failed', code)
    return null
  }
}

export async function getFirebaseUserByUid(uid: string) {
  return await getFirebaseAuth().getUser(uid)
}

export async function getFirebaseUserByEmail(email: string) {
  return await getFirebaseAuth().getUserByEmail(email)
}
