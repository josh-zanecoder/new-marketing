import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

interface FirebaseEnv {
  projectId: string
  clientEmail: string
  privateKey: string
}

function getFirebaseEnv(): FirebaseEnv {
  const config = useRuntimeConfig()
  const projectId = config.firebaseProjectId || ''
  const clientEmail = config.firebaseClientEmail || ''
  const privateKeyRaw = config.firebasePrivateKey || ''

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
  return await getFirebaseAuth().verifyIdToken(idToken)
}

export async function getFirebaseUserByUid(uid: string) {
  return await getFirebaseAuth().getUser(uid)
}

export async function getFirebaseUserByEmail(email: string) {
  return await getFirebaseAuth().getUserByEmail(email)
}
